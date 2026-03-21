local charmaps = require("data.charmaps")

local LocationLookup = {}

local _cache = nil
local _scanAttempted = false

local PALLET_MAPSEC = 0x58 -- 88

-- GBA charmap: A=0xBB..Z=0xD4, a=0xD5..z=0xEE, space=0x00, '.'=0xAD, ''''=0xB4, terminator=0xFF
-- Build search patterns for "Pallet" in both cases
local SEARCH_PATTERNS = {
    { label = "Pallet Town",
      bytes = {0xCA, 0xD5, 0xE0, 0xE0, 0xD9, 0xE8, 0x00, 0xCE, 0xE3, 0xEB, 0xE2} },
    { label = "PALLET TOWN",
      bytes = {0xCA, 0xBB, 0xC6, 0xC6, 0xBF, 0xCE, 0x00, 0xCE, 0xC9, 0xD1, 0xC8} },
}

local CFRU_FALLBACK = {
    [88]  = "Pallet Town",
    [89]  = "Viridian City",
    [90]  = "Pewter City",
    [91]  = "Cerulean City",
    [92]  = "Lavender Town",
    [93]  = "Vermilion City",
    [94]  = "Celadon City",
    [95]  = "Fuchsia City",
    [96]  = "Cinnabar Island",
    [97]  = "Indigo Plateau",
    [98]  = "Saffron City",
    [99]  = "Route 4",
    [100] = "Route 10",
    [101] = "Route 1",   [102] = "Route 2",   [103] = "Route 3",
    [104] = "Route 4",   [105] = "Route 5",   [106] = "Route 6",
    [107] = "Route 7",   [108] = "Route 8",   [109] = "Route 9",
    [110] = "Route 10",  [111] = "Route 11",  [112] = "Route 12",
    [113] = "Route 13",  [114] = "Route 14",  [115] = "Route 15",
    [116] = "Route 16",  [117] = "Route 17",  [118] = "Route 18",
    [119] = "Route 19",  [120] = "Route 20",  [121] = "Route 21",
    [122] = "Route 22",  [123] = "Route 23",  [124] = "Route 24",
    [125] = "Route 25",
    [126] = "Viridian Forest",
    [127] = "Mt. Moon",
    [128] = "S.S. Anne",
    [129] = "Underground Path",
    [130] = "Underground Path",
    [131] = "Diglett's Cave",
    [132] = "Victory Road",
    [133] = "Rocket Hideout",
    [134] = "Silph Co.",
    [135] = "Pokemon Mansion",
    [136] = "Safari Zone",
    [137] = "Pokemon League",
    [138] = "Rock Tunnel",
    [139] = "Seafoam Islands",
    [140] = "Pokemon Tower",
    [141] = "Cerulean Cave",
    [142] = "Power Plant",
    [143] = "One Island",
    [144] = "Two Island",
    [145] = "Three Island",
    [146] = "Four Island",
    [147] = "Five Island",
    [148] = "Seven Island",
    [149] = "Six Island",
    [150] = "Kindle Road",
    [151] = "Treasure Beach",
    [152] = "Cape Brink",
    [153] = "Bond Bridge",
    [154] = "Three Isle Port",
    [175] = "Mt. Ember",
    [176] = "Berry Forest",
    [195] = "Ember Spa",
    [196] = "Celadon Dept.",
}

local function readGBAString(addr)
    local chars = {}
    local charmap = charmaps.GBACharmap
    for i = 0, 24 do
        local byte = memory.read_u8((addr + i) & 0x1FFFFFF, "ROM")
        if byte == 0xFF then break end
        local ch = charmap[byte]
        if ch then
            chars[#chars + 1] = ch
        end
    end
    local str = table.concat(chars)
    return str:gsub("%s*$", "")
end

local function isROMPointer(val)
    return val >= 0x08000000 and val < 0x0A000000
end

-- Scan a region of ROM for a byte pattern. Yields every ~64KB to keep emulator responsive.
local function findPattern(pattern, romSize)
    local patLen = #pattern
    for addr = 0, romSize - patLen do
        local match = true
        for i = 1, patLen do
            if memory.read_u8(addr + i - 1, "ROM") ~= pattern[i] then
                match = false
                break
            end
        end
        if match then
            return addr
        end
        if addr % 0x10000 == 0 and emu and emu.frameadvance then
            emu.frameadvance()
        end
    end
    return nil
end

-- Scan a region of ROM for 4-byte pointer to a given absolute ROM address.
-- Searches near the string first (±2MB), then widens if needed.
local function findPointers(targetAbsAddr, romSize)
    local b1 = targetAbsAddr & 0xFF
    local b2 = (targetAbsAddr >> 8) & 0xFF
    local b3 = (targetAbsAddr >> 16) & 0xFF
    local b4 = (targetAbsAddr >> 24) & 0xFF
    local results = {}
    local targetROMOffset = targetAbsAddr - 0x08000000

    -- Search in expanding rings: ±2MB around string, then full ROM
    local ranges = {
        { math.max(0, targetROMOffset - 0x200000), math.min(romSize - 4, targetROMOffset + 0x200000) },
        { 0, romSize - 4 },
    }

    for _, range in ipairs(ranges) do
        if #results > 0 then break end
        local lo, hi = range[1], range[2]
        -- Align to 4-byte boundary (pointers are word-aligned)
        lo = lo - (lo % 4)
        console.log(string.format("[LocationLookup] Pointer search 0x%06X-0x%06X...", lo, hi))
        for addr = lo, hi, 4 do
            if memory.read_u8(addr, "ROM") == b1 and
               memory.read_u8(addr + 1, "ROM") == b2 and
               memory.read_u8(addr + 2, "ROM") == b3 and
               memory.read_u8(addr + 3, "ROM") == b4 then
                results[#results + 1] = addr
            end
            if addr % 0x40000 == 0 and emu and emu.frameadvance then
                emu.frameadvance()
            end
        end
    end
    return results
end

local function tryFindTable(palletROMAddr, romSize)
    local ptrLocations = findPointers(palletROMAddr, romSize)
    console.log(string.format("[LocationLookup] Found %d pointer candidates", #ptrLocations))

    for _, ptrOffset in ipairs(ptrLocations) do
        for _, structSize in ipairs({8, 4, 12, 16}) do
            local tableBase = ptrOffset - (PALLET_MAPSEC * structSize)
            if tableBase >= 0 and tableBase + 255 * structSize < romSize then
                local nextPtr = memory.read_u32_le(tableBase + 89 * structSize, "ROM")
                if isROMPointer(nextPtr) then
                    local testName = readGBAString(nextPtr & 0x1FFFFFF)
                    if testName:upper():find("VIRIDIAN") then
                        console.log(string.format(
                            "[LocationLookup] Table found at ROM+0x%06X (stride=%d bytes)",
                            tableBase, structSize
                        ))

                        local locations = {}
                        local count = 0
                        for mapsec = 0, 255 do
                            local entryAddr = tableBase + mapsec * structSize
                            if entryAddr + 4 <= romSize then
                                local namePtr = memory.read_u32_le(entryAddr, "ROM")
                                if isROMPointer(namePtr) then
                                    local name = readGBAString(namePtr & 0x1FFFFFF)
                                    if name ~= "" then
                                        locations[mapsec] = name
                                        count = count + 1
                                    end
                                end
                            end
                        end

                        console.log(string.format("[LocationLookup] Loaded %d location names from ROM", count))
                        for mapsec = 88, 98 do
                            if locations[mapsec] then
                                console.log(string.format("  [%3d] %s", mapsec, locations[mapsec]))
                            end
                        end
                        return locations
                    end
                end
            end
        end
    end
    return nil
end

local function scanROM()
    if _scanAttempted then return _cache end
    _scanAttempted = true

    console.log("[LocationLookup] Scanning ROM for MAPSEC name table...")

    -- Detect ROM size (try reading at decreasing power-of-2 boundaries)
    local romSize = 0x01000000 -- 16MB default
    local ok, _ = pcall(function() memory.read_u8(0x01800000, "ROM") end)
    if ok then romSize = 0x02000000 end -- 32MB

    console.log(string.format("[LocationLookup] ROM size: %dMB", romSize / 0x100000))

    for _, pat in ipairs(SEARCH_PATTERNS) do
        console.log(string.format("[LocationLookup] Searching for '%s'...", pat.label))
        local found = findPattern(pat.bytes, romSize)
        if found then
            local absAddr = 0x08000000 + found
            console.log(string.format("[LocationLookup] Found '%s' at 0x%08X", pat.label, absAddr))
            local locations = tryFindTable(absAddr, romSize)
            if locations then
                _cache = locations
                return _cache
            end
        end
    end

    console.log("[LocationLookup] ROM scan did not find name table, using CFRU fallback")
    _cache = CFRU_FALLBACK
    return _cache
end

function LocationLookup.init()
    local ok, err = pcall(scanROM)
    if not ok then
        console.log("[LocationLookup] Scan error: " .. tostring(err) .. " — using fallback")
        _cache = CFRU_FALLBACK
        _scanAttempted = true
    end
end

function LocationLookup.getName(id)
    if not id then return "Unknown" end
    local locations = _cache or CFRU_FALLBACK
    return locations[id] or string.format("Location %d", id)
end

function LocationLookup.getAll()
    return _cache or CFRU_FALLBACK
end

function LocationLookup.dumpToConsole()
    local locations = _cache or CFRU_FALLBACK
    console.log("--- MAPSEC Location Dump ---")
    local keys = {}
    for k in pairs(locations) do keys[#keys + 1] = k end
    table.sort(keys)
    for _, k in ipairs(keys) do
        console.log(string.format("  [%3d] (0x%02X) = %s", k, k, locations[k]))
    end
    console.log(string.format("--- Total: %d entries ---", #keys))
end

return LocationLookup
