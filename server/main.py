from __future__ import annotations

import json
import logging
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
    CreateRoomResponse,
    EventType,
    GameProfile,
    JoinRoomRequest,
    JoinRoomResponse,
    LocalEvent,
    PairGroup,
    PlayerPresence,
    PlayerSnapshot,
    ReconcileRequest,
    Room,
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


app = FastAPI(title="PK ROM Tool Soul Link Sync", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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


def auto_pair_catches(room: Room):
    catches_by_route: dict[int, dict[str, CatchRecord]] = {}
    for catch in room.catches:
        if catch.route not in catches_by_route:
            catches_by_route[catch.route] = {}
        if catch.player_id not in catches_by_route[catch.route]:
            catches_by_route[catch.route][catch.player_id] = catch

    room.pairs = []
    for route, player_catches in catches_by_route.items():
        route_name = next((c.route_name for c in player_catches.values()), "")
        room.pairs.append(PairGroup(route=route, route_name=route_name, pokemon=player_catches))
    room.pairs.sort(key=lambda pair: pair.route)


def propagate_death(room: Room, dead_personality: int, dead_player_id: str):
    dead_route = None
    for catch in room.catches:
        if catch.player_id == dead_player_id and catch.personality == dead_personality:
            catch.alive = False
            catch.in_party = True
            dead_route = catch.route
            break

    if dead_route is not None:
        for catch in room.catches:
            if catch.route == dead_route:
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
async def create_room():
    code = generate_room_code()
    while code in rooms:
        code = generate_room_code()
    room = Room(code=code)
    rooms[code] = room
    await db.save_room(room)
    logger.info("Room created: %s", code)
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

    if room.required_profile is None:
        room.required_profile = request.profile
        await db.save_room(room)

    now = datetime.utcnow()
    existing = room.players.get(request.player_id)
    if existing:
        existing.player_name = request.player_name
        existing.profile = request.profile
        existing.last_seen = now
        player = existing
    else:
        player = PlayerPresence(
            player_id=request.player_id,
            player_name=request.player_name,
            profile=request.profile,
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
    )


@app.get("/rooms")
async def list_rooms():
    return {
        "rooms": [
            {
                "code": room.code,
                "required_profile": room.required_profile.model_dump() if room.required_profile else None,
                "players": [player.model_dump(mode="json") for player in room.players.values()],
                "created_at": room.created_at.isoformat(),
                "catches_count": len(room.catches),
            }
            for room in rooms.values()
        ]
    }


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
    file_path = _web_dir / path
    if file_path.is_file():
        return FileResponse(str(file_path))
    raise HTTPException(status_code=404)


@app.get("/assets/{path:path}")
async def serve_built_assets(path: str):
    file_path = _web_dir / "assets" / path
    if file_path.is_file():
        return FileResponse(str(file_path))
    raise HTTPException(status_code=404)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
