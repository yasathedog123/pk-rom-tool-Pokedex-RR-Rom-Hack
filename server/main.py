from __future__ import annotations

import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

import database as db
from models import (
    CatchRecord,
    CompatibilityResult,
    CreateRoomRequest,
    CreateRoomResponse,
    EventType,
    GameProfile,
    JoinRoomRequest,
    JoinRoomResponse,
    LocalEvent,
    PairGroup,
    PlayerPresence,
    PlayerSnapshot,
    ReassignRequest,
    ReconcileRequest,
    Room,
    RoomSettings,
    RoomState,
    SyncPokemon,
    generate_room_code,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("pkrom.sync")

rooms: dict[str, Room] = {}
ws_connections: dict[str, list[WebSocket]] = {}
_server_dir = Path(__file__).resolve().parent
_web_dir = _server_dir.parent / "web" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    global rooms
    logger.info("PK ROM Tool sync server starting up")
    await db.initialize()
    rooms = await db.load_all_rooms()
    yield
    await db.close()
    logger.info("PK ROM Tool sync server shutting down")


app = FastAPI(title="Link Cable Sync Server", version="0.2.0", lifespan=lifespan)

_cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_room(code: str) -> Room:
    room = rooms.get(code)
    if not room:
        raise HTTPException(status_code=404, detail=f"Room '{code}' not found")
    return room


async def broadcast_to_room(code: str, message: dict):
    connections = ws_connections.get(code, [])
    if not connections:
        return
    payload = json.dumps(message, default=str)
    disconnected: list[WebSocket] = []
    for ws in connections:
        try:
            await ws.send_text(payload)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        connections.remove(ws)


def compatibility_for(room: Room, profile: GameProfile) -> CompatibilityResult:
    if room.required_profile is None:
        return CompatibilityResult(compatible=True, required_profile=None)

    incoming_key = profile.compatibility_key()
    required_key = room.required_profile.compatibility_key()
    if incoming_key == required_key:
        return CompatibilityResult(compatible=True, required_profile=room.required_profile)

    return CompatibilityResult(
        compatible=False,
        reason=(
            "Incompatible game profile. Room requires "
            f"{room.required_profile.game_name} {room.required_profile.game_version or ''}".strip()
        ),
        required_profile=room.required_profile,
    )


def auto_assign_catch(room: Room, catch: CatchRecord):
    player_map = room.route_assignments.setdefault(catch.player_id, {})
    if catch.route not in player_map:
        player_map[catch.route] = catch.personality


def _get_player_team(room: Room, player_id: str) -> str:
    presence = room.players.get(player_id)
    return (presence.team if presence else "") or ""


def auto_pair_catches(room: Room):
    catch_index: dict[tuple[str, int], CatchRecord] = {}
    routes_seen: dict[int, str] = {}
    for catch in room.catches:
        catch_index[(catch.player_id, catch.personality)] = catch
        if catch.route not in routes_seen and catch.route_name:
            routes_seen[catch.route] = catch.route_name
        auto_assign_catch(room, catch)

    is_race = room.settings.mode == "race"

    if is_race:
        from collections import defaultdict
        teams: dict[str, list[str]] = defaultdict(list)
        for pid in room.players:
            teams[_get_player_team(room, pid) or "A"].append(pid)
        team_groups = list(teams.items())
    else:
        team_groups = [("", list(room.players.keys()))]

    room.pairs = []
    for team_label, team_pids in team_groups:
        team_pid_set = set(team_pids)
        all_routes: set[int] = set()
        for pid in team_pids:
            player_map = room.route_assignments.get(pid, {})
            all_routes.update(player_map.keys())

        for route in sorted(all_routes):
            route_name = routes_seen.get(route, "")
            player_catches: dict[str, CatchRecord] = {}
            for player_id in team_pids:
                player_map = room.route_assignments.get(player_id, {})
                personality = player_map.get(route)
                if personality is None:
                    continue
                catch = catch_index.get((player_id, personality))
                if catch:
                    player_catches[player_id] = catch
                    if not route_name and catch.route_name:
                        route_name = catch.route_name
            if player_catches:
                room.pairs.append(PairGroup(route=route, route_name=route_name, pokemon=player_catches, team=team_label))
    room.pairs.sort(key=lambda pair: min(
        (c.timestamp for c in pair.pokemon.values() if hasattr(c, 'timestamp') and c.timestamp),
        default=datetime(2000, 1, 1)
    ))


def propagate_death(room: Room, dead_personality: int, dead_player_id: str):
    dead_route = None
    for catch in room.catches:
        if catch.player_id == dead_player_id and catch.personality == dead_personality:
            catch.alive = False
            catch.in_party = True
            dead_route = catch.route
            break

    if dead_route is not None:
        is_race = room.settings.mode == "race"
        dead_team = _get_player_team(room, dead_player_id) if is_race else None
        for catch in room.catches:
            if catch.route == dead_route:
                if is_race:
                    if _get_player_team(room, catch.player_id) == dead_team:
                        catch.alive = False
                else:
                    catch.alive = False
    auto_pair_catches(room)
    return dead_route


def catch_from_sync_event(event: LocalEvent) -> CatchRecord:
    mon = event.pokemon
    return CatchRecord(
        id=event.id,
        player_id=event.player_id,
        player_name=event.player_name,
        species_id=mon.species_id,
        species_name=mon.species_name or mon.nickname or f"Pokemon #{mon.species_id}",
        nickname=mon.nickname,
        route=mon.met_location,
        route_name=mon.met_location_name,
        level=mon.level,
        personality=mon.personality,
        met_level=mon.met_level,
        types=mon.types,
        alive=mon.alive,
        in_party=mon.in_party,
        nature=mon.nature,
        ivs=mon.ivs,
        evs=mon.evs,
        held_item=mon.held_item,
        held_item_id=mon.held_item_id,
        hidden_power=mon.hidden_power,
        friendship=mon.friendship,
        timestamp=datetime.utcfromtimestamp(event.timestamp) if event.timestamp else datetime.utcnow(),
    )


def merge_recent_events(room: Room, events: list[LocalEvent]) -> list[LocalEvent]:
    known_ids = {event.id for event in room.events}
    accepted: list[LocalEvent] = []
    for event in events:
        if event.id not in known_ids:
            room.events.append(event)
            accepted.append(event)
            known_ids.add(event.id)
    room.events.sort(key=lambda ev: ev.timestamp)
    if len(room.events) > 200:
        room.events = room.events[-200:]
    return accepted


def ensure_snapshot_catches(room: Room, snapshot: PlayerSnapshot):
    known_personalities = {c.personality for c in room.catches if c.player_id == snapshot.player_id}
    for pokemon in snapshot.current_party:
        if pokemon.personality in known_personalities:
            continue
        inferred = CatchRecord(
            id=f"reconcile-{snapshot.player_id}-{pokemon.personality}",
            player_id=snapshot.player_id,
            player_name=snapshot.player_name,
            species_id=pokemon.species_id,
            species_name=pokemon.species_name or pokemon.nickname or f"Pokemon #{pokemon.species_id}",
            nickname=pokemon.nickname,
            route=pokemon.met_location,
            route_name=pokemon.met_location_name,
            level=pokemon.level,
            personality=pokemon.personality,
            met_level=pokemon.met_level,
            types=pokemon.types,
            alive=pokemon.current_hp > 0,
            in_party=True,
            nature=pokemon.nature,
            ivs=pokemon.ivs,
            evs=pokemon.evs,
            held_item=pokemon.held_item,
            held_item_id=pokemon.held_item_id,
            hidden_power=pokemon.hidden_power,
            friendship=pokemon.friendship,
            timestamp=datetime.utcnow(),
        )
        room.catches.append(inferred)


def update_in_party_flags(room: Room, snapshot: PlayerSnapshot):
    party_personalities = {pokemon.personality for pokemon in snapshot.current_party}
    for catch in room.catches:
        if catch.player_id == snapshot.player_id:
            catch.in_party = catch.personality in party_personalities


@app.post("/rooms", response_model=CreateRoomResponse)
async def create_room(request: CreateRoomRequest = None):
    code = generate_room_code()
    while code in rooms:
        code = generate_room_code()
    settings = RoomSettings()
    if request:
        if request.mode in ("soullink", "race"):
            settings.mode = request.mode
        if request.max_players > 0:
            settings.max_players = request.max_players
        if request.team_names:
            settings.team_names = request.team_names
    room = Room(code=code, settings=settings)
    rooms[code] = room
    await db.save_room(room)
    logger.info("Room created: %s (mode=%s, max=%s)", code, settings.mode, settings.max_players)
    return CreateRoomResponse(code=code)


@app.post("/rooms/{code}/join", response_model=JoinRoomResponse)
async def join_room(code: str, request: JoinRoomRequest):
    if code not in rooms:
        room = Room(code=code)
        rooms[code] = room
        await db.save_room(room)
    room = rooms[code]

    compatibility = compatibility_for(room, request.profile)
    if not compatibility.compatible:
        return JoinRoomResponse(code=code, compatibility=compatibility, players=list(room.players.values()))

    if room.settings.max_players > 0 and request.player_id not in room.players:
        if len(room.players) >= room.settings.max_players:
            return JoinRoomResponse(
                code=code,
                compatibility=CompatibilityResult(compatible=False, reason=f"Room is full ({room.settings.max_players} players max)"),
                players=list(room.players.values()),
            )

    if room.required_profile is None:
        room.required_profile = request.profile
        await db.save_room(room)

    team = request.team or ""
    now = datetime.utcnow()
    existing = room.players.get(request.player_id)
    if existing:
        existing.player_name = request.player_name
        existing.profile = request.profile
        existing.last_seen = now
        if team:
            existing.team = team
        player = existing
    else:
        player = PlayerPresence(
            player_id=request.player_id,
            player_name=request.player_name,
            profile=request.profile,
            team=team,
            joined_at=now,
            last_seen=now,
        )
        room.players[request.player_id] = player

    await db.save_player(code, player)
    await broadcast_to_room(
        code,
        {
            "type": "player_joined",
            "player_id": request.player_id,
            "player_name": request.player_name,
            "players": [p.model_dump(mode="json") for p in room.players.values()],
        },
    )
    return JoinRoomResponse(code=code, compatibility=CompatibilityResult(compatible=True, required_profile=room.required_profile), players=list(room.players.values()))


@app.post("/rooms/{code}/event")
async def receive_event(code: str, event: LocalEvent):
    room = get_room(code)
    if event.player_id not in room.players:
        raise HTTPException(status_code=409, detail="Player must join room before sending events")

    accepted = merge_recent_events(room, [event])
    if not accepted:
        return {"message": "Duplicate event, ignored", "id": event.id}

    if event.type in (EventType.CATCH, EventType.GIFT):
        catch = catch_from_sync_event(event)
        if all(existing.personality != catch.personality for existing in room.catches):
            room.catches.append(catch)
            auto_pair_catches(room)
            await db.save_catch(code, catch)
        logger.info("[%s] %s caught %s on %s", code, event.player_name, catch.species_name, catch.route_name)
        await broadcast_to_room(
            code,
            {
                "type": "catch",
                "event": catch.model_dump(mode="json"),
                "pairs": [pair.model_dump(mode="json") for pair in room.pairs],
            },
        )
    elif event.type == EventType.FAINT:
        dead_route = propagate_death(room, event.pokemon.personality, event.player_id)
        if dead_route is not None:
            await db.update_catch_route_status(code, dead_route, False)
        await broadcast_to_room(
            code,
            {
                "type": "faint",
                "event": event.model_dump(mode="json"),
                "pairs": [pair.model_dump(mode="json") for pair in room.pairs],
                "catches": [catch.model_dump(mode="json") for catch in room.catches],
            },
        )

    await db.save_event(code, event)
    return {"message": "Event received", "id": event.id}


@app.post("/rooms/{code}/reconcile")
async def reconcile_room(code: str, request: ReconcileRequest):
    room = get_room(code)
    if request.player_id not in room.players:
        raise HTTPException(status_code=409, detail="Player must join room before reconciling")

    snapshot = PlayerSnapshot(
        player_id=request.player_id,
        player_name=request.player_name,
        current_party=request.current_party,
        enemy_party=request.enemy_party,
        updated_at=datetime.utcnow(),
    )
    room.player_snapshots[request.player_id] = snapshot
    await db.save_snapshot(code, snapshot)

    accepted_events = merge_recent_events(room, request.recent_events)
    for event in accepted_events:
        if event.type in (EventType.CATCH, EventType.GIFT):
            catch = catch_from_sync_event(event)
            if all(existing.personality != catch.personality for existing in room.catches):
                room.catches.append(catch)
                await db.save_catch(code, catch)
        elif event.type == EventType.FAINT:
            dead_route = propagate_death(room, event.pokemon.personality, event.player_id)
            if dead_route is not None:
                await db.update_catch_route_status(code, dead_route, False)
        await db.save_event(code, event)

    ensure_snapshot_catches(room, snapshot)
    update_in_party_flags(room, snapshot)
    auto_pair_catches(room)

    for catch in room.catches:
        if catch.player_id != request.player_id:
            continue
        if not catch.alive:
            continue
        matching = next((pokemon for pokemon in snapshot.current_party if pokemon.personality == catch.personality), None)
        if matching and matching.current_hp == 0:
            dead_route = propagate_death(room, catch.personality, catch.player_id)
            if dead_route is not None:
                await db.update_catch_route_status(code, dead_route, False)

    for catch in room.catches:
        await db.save_catch(code, catch)

    await broadcast_to_room(
        code,
        {
            "type": "reconcile",
            "player_id": request.player_id,
            "player_name": request.player_name,
            "pairs": [pair.model_dump(mode="json") for pair in room.pairs],
            "catches": [catch.model_dump(mode="json") for catch in room.catches],
            "snapshots": {pid: snap.model_dump(mode="json") for pid, snap in room.player_snapshots.items()},
        },
    )
    return {"message": "Reconciliation received", "accepted_events": len(accepted_events)}


class OverrideDeathRequest(BaseModel):
    route: int
    alive: bool


@app.post("/rooms/{code}/override-death")
async def override_death(code: str, request: OverrideDeathRequest):
    room = get_room(code)
    changed = False
    for catch in room.catches:
        if catch.route == request.route:
            catch.alive = request.alive
            changed = True
    if changed:
        auto_pair_catches(room)
        await db.update_catch_route_status(code, request.route, request.alive)
        for catch in room.catches:
            await db.save_catch(code, catch)
        await broadcast_to_room(code, {
            "type": "override",
            "route": request.route,
            "alive": request.alive,
            "pairs": [pair.model_dump(mode="json") for pair in room.pairs],
            "catches": [catch.model_dump(mode="json") for catch in room.catches],
        })
    return {"message": "Override applied", "route": request.route, "alive": request.alive}


@app.post("/rooms/{code}/reassign")
async def reassign_route(code: str, request: ReassignRequest):
    room = get_room(code)
    if request.player_id not in room.players:
        raise HTTPException(status_code=409, detail="Player must join room before reassigning")

    catch = next(
        (c for c in room.catches if c.player_id == request.player_id and c.personality == request.personality),
        None,
    )
    if not catch:
        raise HTTPException(status_code=404, detail="Pokemon not found in player catches")

    room.route_assignments.setdefault(request.player_id, {})[request.route] = request.personality
    auto_pair_catches(room)
    await db.save_room(room)
    for c in room.catches:
        await db.save_catch(code, c)

    logger.info("[%s] %s reassigned route %s to personality %s", code, request.player_id, request.route, request.personality)
    await broadcast_to_room(code, {
        "type": "reassign",
        "player_id": request.player_id,
        "route": request.route,
        "personality": request.personality,
        "pairs": [pair.model_dump(mode="json") for pair in room.pairs],
        "catches": [catch.model_dump(mode="json") for catch in room.catches],
        "route_assignments": room.route_assignments,
    })
    return {"message": "Route reassigned", "route": request.route, "personality": request.personality}


@app.post("/rooms/{code}/team-names")
async def update_team_names(code: str, request: dict):
    room = get_room(code)
    names = request.get("team_names", {})
    room.settings.team_names = {k: str(v)[:32] for k, v in names.items()}
    await db.save_room(room)
    await broadcast_to_room(code, {"type": "settings_update"})
    return {"message": "Team names updated"}


@app.get("/rooms/{code}/state", response_model=RoomState)
async def get_room_state(code: str):
    room = get_room(code)
    return RoomState(
        code=room.code,
        required_profile=room.required_profile,
        players=list(room.players.values()),
        catches=room.catches,
        pairs=room.pairs,
        player_snapshots=room.player_snapshots,
        events=room.events[-100:],
        settings=room.settings,
        route_assignments=room.route_assignments,
    )


@app.websocket("/rooms/{code}/ws")
async def websocket_endpoint(websocket: WebSocket, code: str):
    await websocket.accept()
    ws_connections.setdefault(code, []).append(websocket)

    room = rooms.get(code)
    if room:
        await websocket.send_text(
            json.dumps(
                {
                    "type": "state",
                    "data": RoomState(
                        code=room.code,
                        required_profile=room.required_profile,
                        players=list(room.players.values()),
                        catches=room.catches,
                        pairs=room.pairs,
                        player_snapshots=room.player_snapshots,
                        events=room.events[-100:],
                        settings=room.settings,
                        route_assignments=room.route_assignments,
                    ).model_dump(mode="json"),
                },
                default=str,
            )
        )

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        ws_connections[code].remove(websocket)


@app.get("/health")
async def health():
    return {"status": "ok", "rooms": len(rooms)}


@app.get("/")
async def serve_web_index():
    index_path = _web_dir / "index.html"
    if index_path.is_file():
        return FileResponse(str(index_path))
    return {"message": "PK ROM Tool Soul Link Sync", "web": "not found"}


@app.get("/app/{path:path}")
async def serve_web_assets(path: str):
    file_path = (_web_dir / path).resolve()
    if not file_path.is_relative_to(_web_dir.resolve()):
        raise HTTPException(status_code=403)
    if file_path.is_file():
        return FileResponse(str(file_path))
    raise HTTPException(status_code=404)


@app.get("/assets/{path:path}")
async def serve_built_assets(path: str):
    assets_dir = (_web_dir / "assets").resolve()
    file_path = (assets_dir / path).resolve()
    if not file_path.is_relative_to(assets_dir):
        raise HTTPException(status_code=403)
    if file_path.is_file():
        return FileResponse(str(file_path))
    raise HTTPException(status_code=404)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
