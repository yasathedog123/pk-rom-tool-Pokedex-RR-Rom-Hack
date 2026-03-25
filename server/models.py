from __future__ import annotations

from datetime import datetime
from enum import Enum
import secrets
import string

from pydantic import BaseModel, Field


class EventType(str, Enum):
    CATCH = "catch"
    FAINT = "faint"
    GIFT = "gift"


class SourceKind(str, Enum):
    LOCAL_BROWSER = "local_browser"
    LUA_CLIENT = "lua_client"


class GameProfile(BaseModel):
    game_name: str
    game_version: str = ""
    generation: str = ""
    engine: str = ""
    profile_id: str = ""
    rom_hash: str = ""
    client_version: str = ""

    def compatibility_key(self) -> str:
        if self.rom_hash:
            return f"rom:{self.rom_hash}"
        if self.profile_id:
            return f"profile:{self.profile_id}"
        return "|".join(
            [
                self.game_name.strip(),
                self.game_version.strip(),
                self.generation.strip(),
                self.engine.strip(),
            ]
        )


class JoinRoomRequest(BaseModel):
    player_id: str
    player_name: str
    profile: GameProfile
    source: SourceKind = SourceKind.LOCAL_BROWSER
    team: str = ""


class PlayerIdentity(BaseModel):
    player_id: str
    player_name: str


class RoomSettings(BaseModel):
    level_cap: int = 0
    dupes_clause: bool = True
    shiny_clause: bool = True
    species_clause: bool = False
    gift_clause: str = "separate"
    mode: str = "soullink"
    max_players: int = 0
    team_names: dict[str, str] = {}


class SyncPokemon(BaseModel):
    personality: int
    species_id: int
    species_name: str = ""
    nickname: str = ""
    level: int = 0
    current_hp: int = 0
    max_hp: int = 0
    met_location: int = 0
    met_location_name: str = ""
    met_level: int = 0
    types: list[str] = []
    alive: bool = True
    in_party: bool = True
    nature: str = ""
    ivs: dict = {}
    evs: dict = {}
    held_item: str = ""
    held_item_id: int = 0
    hidden_power: str = ""
    friendship: int = 0
    move_names: list[str] = []
    ability: str = ""
    status: str = "Healthy"
    is_shiny: bool = False


class LocalEvent(BaseModel):
    id: str
    type: EventType
    player_id: str
    player_name: str
    timestamp: int
    source: str = "local"
    pokemon: SyncPokemon


class ReconcileRequest(BaseModel):
    player_id: str
    player_name: str
    timestamp: int
    current_party: list[SyncPokemon] = []
    enemy_party: list[SyncPokemon] = []
    recent_events: list[LocalEvent] = []


class CatchRecord(BaseModel):
    id: str
    player_id: str
    player_name: str
    species_id: int
    species_name: str
    nickname: str
    route: int
    route_name: str
    level: int
    personality: int
    met_level: int = 0
    types: list[str] = []
    alive: bool = True
    in_party: bool = True
    nature: str = ""
    ivs: dict = {}
    evs: dict = {}
    held_item: str = ""
    held_item_id: int = 0
    hidden_power: str = ""
    friendship: int = 0
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class PairGroup(BaseModel):
    route: int
    route_name: str
    pokemon: dict[str, CatchRecord] = {}
    team: str = ""


class PlayerPresence(BaseModel):
    player_id: str
    player_name: str
    profile: GameProfile
    team: str = ""
    joined_at: datetime = Field(default_factory=datetime.utcnow)
    last_seen: datetime = Field(default_factory=datetime.utcnow)


class PlayerSnapshot(BaseModel):
    player_id: str
    player_name: str
    current_party: list[SyncPokemon] = []
    enemy_party: list[SyncPokemon] = []
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Room(BaseModel):
    code: str
    required_profile: GameProfile | None = None
    players: dict[str, PlayerPresence] = {}
    catches: list[CatchRecord] = []
    pairs: list[PairGroup] = []
    player_snapshots: dict[str, PlayerSnapshot] = {}
    events: list[LocalEvent] = []
    settings: RoomSettings = Field(default_factory=RoomSettings)
    route_assignments: dict[str, dict[int, int]] = {}
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CompatibilityResult(BaseModel):
    compatible: bool
    reason: str = ""
    required_profile: GameProfile | None = None


class JoinRoomResponse(BaseModel):
    code: str
    compatibility: CompatibilityResult
    players: list[PlayerPresence] = []


class ReassignRequest(BaseModel):
    player_id: str
    route: int
    personality: int


class RoomState(BaseModel):
    code: str
    required_profile: GameProfile | None = None
    players: list[PlayerPresence]
    catches: list[CatchRecord]
    pairs: list[PairGroup]
    player_snapshots: dict[str, PlayerSnapshot]
    events: list[LocalEvent]
    settings: RoomSettings = Field(default_factory=RoomSettings)
    route_assignments: dict[str, dict[int, int]] = {}


class CreateRoomRequest(BaseModel):
    mode: str = "soullink"
    max_players: int = 0
    team_names: dict[str, str] = {}


class CreateRoomResponse(BaseModel):
    code: str
    message: str = "Room created"


def generate_room_code(length: int = 6) -> str:
    chars = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))
