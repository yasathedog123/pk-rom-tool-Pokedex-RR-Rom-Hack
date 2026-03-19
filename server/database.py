from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path

import aiosqlite

from models import (
    CatchRecord,
    GameProfile,
    LocalEvent,
    PairGroup,
    PlayerPresence,
    PlayerSnapshot,
    Room,
    RoomSettings,
    SyncPokemon,
)

logger = logging.getLogger("pkrom.sync.db")

DB_PATH = Path(__file__).resolve().parent / "pkrom_soullink.db"

_db: aiosqlite.Connection | None = None


async def initialize():
    global _db
    _db = await aiosqlite.connect(str(DB_PATH))
    _db.row_factory = aiosqlite.Row
    await _db.executescript(
        """
        CREATE TABLE IF NOT EXISTS rooms (
            code TEXT PRIMARY KEY,
            required_profile_json TEXT DEFAULT NULL,
            settings_json TEXT DEFAULT '{}',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS players (
            room_code TEXT NOT NULL,
            player_id TEXT NOT NULL,
            player_name TEXT NOT NULL,
            profile_json TEXT NOT NULL,
            joined_at TEXT NOT NULL,
            last_seen TEXT NOT NULL,
            PRIMARY KEY (room_code, player_id)
        );

        CREATE TABLE IF NOT EXISTS catches (
            id TEXT PRIMARY KEY,
            room_code TEXT NOT NULL,
            player_id TEXT NOT NULL,
            player_name TEXT NOT NULL,
            species_id INTEGER NOT NULL,
            species_name TEXT NOT NULL,
            nickname TEXT DEFAULT '',
            route INTEGER NOT NULL,
            route_name TEXT DEFAULT '',
            level INTEGER DEFAULT 0,
            personality INTEGER NOT NULL,
            met_level INTEGER DEFAULT 0,
            types_json TEXT DEFAULT '[]',
            alive INTEGER DEFAULT 1,
            in_party INTEGER DEFAULT 1,
            timestamp TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS snapshots (
            room_code TEXT NOT NULL,
            player_id TEXT NOT NULL,
            player_name TEXT NOT NULL,
            current_party_json TEXT DEFAULT '[]',
            updated_at TEXT NOT NULL,
            PRIMARY KEY (room_code, player_id)
        );

        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            room_code TEXT NOT NULL,
            type TEXT NOT NULL,
            player_id TEXT NOT NULL,
            player_name TEXT NOT NULL,
            data_json TEXT NOT NULL,
            timestamp TEXT NOT NULL
        );
        """
    )
    await _db.commit()
    logger.info("Database initialized at %s", DB_PATH)


async def close():
    global _db
    if _db:
        await _db.close()
        _db = None


def _build_pairs(room: Room) -> None:
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


def _sync_pokemon_from_dict(data: dict) -> SyncPokemon:
    return SyncPokemon(**data)


def _local_event_from_dict(data: dict) -> LocalEvent:
    if isinstance(data.get("pokemon"), dict):
        data = dict(data)
        data["pokemon"] = _sync_pokemon_from_dict(data["pokemon"])
    return LocalEvent(**data)


async def load_all_rooms() -> dict[str, Room]:
    if not _db:
        return {}

    rooms: dict[str, Room] = {}

    async with _db.execute("SELECT * FROM rooms") as cursor:
        async for row in cursor:
            profile = json.loads(row["required_profile_json"]) if row["required_profile_json"] else None
            settings = json.loads(row["settings_json"] or "{}")
            rooms[row["code"]] = Room(
                code=row["code"],
                required_profile=GameProfile(**profile) if profile else None,
                settings=RoomSettings(**settings) if settings else RoomSettings(),
                created_at=datetime.fromisoformat(row["created_at"]),
            )

    async with _db.execute("SELECT * FROM players ORDER BY joined_at") as cursor:
        async for row in cursor:
            room = rooms.get(row["room_code"])
            if not room:
                continue
            profile = GameProfile(**json.loads(row["profile_json"]))
            room.players[row["player_id"]] = PlayerPresence(
                player_id=row["player_id"],
                player_name=row["player_name"],
                profile=profile,
                joined_at=datetime.fromisoformat(row["joined_at"]),
                last_seen=datetime.fromisoformat(row["last_seen"]),
            )

    async with _db.execute("SELECT * FROM catches ORDER BY timestamp") as cursor:
        async for row in cursor:
            room = rooms.get(row["room_code"])
            if not room:
                continue
            room.catches.append(
                CatchRecord(
                    id=row["id"],
                    player_id=row["player_id"],
                    player_name=row["player_name"],
                    species_id=row["species_id"],
                    species_name=row["species_name"],
                    nickname=row["nickname"],
                    route=row["route"],
                    route_name=row["route_name"],
                    level=row["level"],
                    personality=row["personality"],
                    met_level=row["met_level"],
                    types=json.loads(row["types_json"] or "[]"),
                    alive=bool(row["alive"]),
                    in_party=bool(row["in_party"]),
                    timestamp=datetime.fromisoformat(row["timestamp"]),
                )
            )

    async with _db.execute("SELECT * FROM snapshots") as cursor:
        async for row in cursor:
            room = rooms.get(row["room_code"])
            if not room:
                continue
            current_party = [_sync_pokemon_from_dict(item) for item in json.loads(row["current_party_json"] or "[]")]
            room.player_snapshots[row["player_id"]] = PlayerSnapshot(
                player_id=row["player_id"],
                player_name=row["player_name"],
                current_party=current_party,
                updated_at=datetime.fromisoformat(row["updated_at"]),
            )

    async with _db.execute("SELECT * FROM events ORDER BY timestamp") as cursor:
        async for row in cursor:
            room = rooms.get(row["room_code"])
            if not room:
                continue
            payload = json.loads(row["data_json"])
            room.events.append(_local_event_from_dict(payload))

    for room in rooms.values():
        _build_pairs(room)

    logger.info("Loaded %s rooms from database", len(rooms))
    return rooms


async def save_room(room: Room):
    if not _db:
        return
    profile_json = json.dumps(room.required_profile.model_dump()) if room.required_profile else None
    await _db.execute(
        "INSERT OR REPLACE INTO rooms (code, required_profile_json, settings_json, created_at) VALUES (?, ?, ?, ?)",
        (
            room.code,
            profile_json,
            json.dumps(room.settings.model_dump()),
            room.created_at.isoformat(),
        ),
    )
    await _db.commit()


async def save_player(room_code: str, player: PlayerPresence):
    if not _db:
        return
    await _db.execute(
        """
        INSERT OR REPLACE INTO players
        (room_code, player_id, player_name, profile_json, joined_at, last_seen)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            room_code,
            player.player_id,
            player.player_name,
            json.dumps(player.profile.model_dump()),
            player.joined_at.isoformat(),
            player.last_seen.isoformat(),
        ),
    )
    await _db.commit()


async def save_snapshot(room_code: str, snapshot: PlayerSnapshot):
    if not _db:
        return
    await _db.execute(
        """
        INSERT OR REPLACE INTO snapshots
        (room_code, player_id, player_name, current_party_json, updated_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            room_code,
            snapshot.player_id,
            snapshot.player_name,
            json.dumps([p.model_dump() for p in snapshot.current_party]),
            snapshot.updated_at.isoformat(),
        ),
    )
    await _db.commit()


async def save_catch(room_code: str, catch: CatchRecord):
    if not _db:
        return
    await _db.execute(
        """
        INSERT OR REPLACE INTO catches
        (id, room_code, player_id, player_name, species_id, species_name, nickname,
         route, route_name, level, personality, met_level, types_json, alive, in_party, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            catch.id,
            room_code,
            catch.player_id,
            catch.player_name,
            catch.species_id,
            catch.species_name,
            catch.nickname,
            catch.route,
            catch.route_name,
            catch.level,
            catch.personality,
            catch.met_level,
            json.dumps(catch.types),
            int(catch.alive),
            int(catch.in_party),
            catch.timestamp.isoformat(),
        ),
    )
    await _db.commit()


async def update_catch_route_status(room_code: str, route: int, alive: bool):
    if not _db:
        return
    await _db.execute(
        "UPDATE catches SET alive = ? WHERE room_code = ? AND route = ?",
        (int(alive), room_code, route),
    )
    await _db.commit()


async def save_event(room_code: str, event: LocalEvent):
    if not _db:
        return
    await _db.execute(
        """
        INSERT OR REPLACE INTO events
        (id, room_code, type, player_id, player_name, data_json, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event.id,
            room_code,
            event.type.value,
            event.player_id,
            event.player_name,
            json.dumps(event.model_dump()),
            datetime.utcnow().isoformat(),
        ),
    )
    await _db.commit()
