-- =============================================================
-- Move & Ability Name Table Dumper (Dev Tool)
-- =============================================================
-- Self-running BizHawk script. Scans the loaded ROM to find the
-- move name table and ability name table, then writes them to
-- files ready to paste into gamesdb.lua.
--
-- Usage:
--   1. Load your ROM in BizHawk (any screen is fine)
--   2. Tools > Lua Console > Open Script > this file
--   3. Wait for "DONE" in the console (~2-5 minutes)
--   4. Check tools/move_names_dump.txt and tools/ability_names_dump.txt
--
-- Output goes to FILES to avoid BizHawk console truncation.
-- =============================================================

local SCRIPT_DIR = debug.getinfo(1, "S").source:match("@?(.*[\\/])") or "./"
local MOVE_OUTPUT = SCRIPT_DIR .. "move_names_dump.txt"
local ABILITY_OUTPUT = SCRIPT_DIR .. "ability_names_dump.txt"

-- ---- GBA character map ----
local GBACharmap = { [0]=
    " ", "À", "Á", "Â", "Ç", "È", "É", "Ê", "Ë", "Ì", "こ", "Î", "Ï", "Ò", "Ó", "Ô",
    "Œ", "Ù", "Ú", "Û", "Ñ", "ß", "à", "á", "ね", "ç", "è", "é", "ê", "ë", "ì", "ま",
    "î", "ï", "ò", "ó", "ô", "œ", "ù", "ú", "û", "ñ", "º", "ª", "", "&", "+", "あ",
    "ぃ", "ぅ", "ぇ", "ぉ", "v", "=", "ょ", "が", "ぎ", "ぐ", "げ", "ご", "ざ", "じ", "ず", "ぜ",
    "ぞ", "だ", "ぢ", "づ", "で", "ど", "ば", "び", "ぶ", "べ", "ぼ", "ぱ", "ぴ", "ぷ", "ぺ", "ぽ",
    "っ", "¿", "¡", "Pk", "Mn", "Po", "Ké", "", "", "", "Í", "%", "(", ")", "セ", "ソ",
    "タ", "チ", "ツ", "テ", "ト", "ナ", "ニ", "ヌ", "â", "ノ", "ハ", "ヒ", "フ", "ヘ", "ホ", "í",
    "ミ", "ム", "メ", "モ", "ヤ", "ユ", "ヨ", "ラ", "リ", "↑", "↓", "←", "→", "ヲ", "ン", "ァ",
    "ィ", "ゥ", "ェ", "ォ", "ャ", "ュ", "ョ", "ガ", "ギ", "グ", "ゲ", "ゴ", "ザ", "ジ", "ズ", "ゼ",
    "ゾ", "ダ", "ヂ", "ヅ", "デ", "ド", "バ", "ビ", "ブ", "ベ", "ボ", "パ", "ピ", "プ", "ペ", "ポ",
    "ッ", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "!", "?", ".", "-", "・",
    "…", "\"", "\"", "'", "'", "♂", "♀", "$", ",", "×", "/", "A", "B", "C", "D", "E",
    "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U",
    "V", "W", "X", "Y", "Z", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k",
    "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "▶",
    ":", "Ä", "Ö", "Ü", "ä", "ö", "ü", "↑", "↓", "←", "", "", "", "", "", ""
}

-- Reverse map: ASCII char -> GBA byte
local ASCIItoGBA = {}
for byte, ch in pairs(GBACharmap) do
    if ch and #ch == 1 then
        ASCIItoGBA[ch] = byte
    end
end
ASCIItoGBA["-"] = 0xAE

local function encodeGBA(str)
    local bytes = {}
    for i = 1, #str do
        local ch = str:sub(i, i)
        local b = ASCIItoGBA[ch]
        if not b then return nil end
        bytes[#bytes + 1] = b
    end
    bytes[#bytes + 1] = 0xFF
    return bytes
end

local function readStr(addr)
    local chars = {}
    for i = 0, 20 do
        local b = memory.read_u8((addr + i) & 0x1FFFFFF, "ROM")
        if b == 0xFF then break end
        local ch = GBACharmap[b]
        if ch then chars[#chars + 1] = ch end
    end
    return table.concat(chars):gsub("%s*$", "")
end

local function isROMPtr(v) return v >= 0x08000000 and v < 0x0A000000 end

local function yield()
    if emu and emu.frameadvance then emu.frameadvance() end
end

local function isValidName(s)
    if #s == 0 or #s > 20 then return false end
    if s:match("^%s") then return false end
    if not s:match("^[A-Z0-9]") then return false end
    return true
end

-- ---- Search helpers ----

local function findAll(pattern, romSize)
    local results = {}
    for addr = 0, romSize - #pattern do
        local ok = true
        for i = 1, #pattern do
            if memory.read_u8(addr + i - 1, "ROM") ~= pattern[i] then ok = false; break end
        end
        if ok then results[#results + 1] = addr end
        if addr % 0x10000 == 0 then yield() end
    end
    return results
end

local function findPtrs(target, romSize)
    local b1, b2, b3, b4 = target & 0xFF, (target>>8) & 0xFF, (target>>16) & 0xFF, (target>>24) & 0xFF
    local results = {}
    local off = target - 0x08000000
    local ranges = {
        { math.max(0, off - 0x200000), math.min(romSize - 4, off + 0x200000) },
        { 0, romSize - 4 },
    }
    for _, range in ipairs(ranges) do
        if #results > 0 then break end
        local lo = range[1] - (range[1] % 4)
        for addr = lo, range[2], 4 do
            if memory.read_u8(addr,"ROM")==b1 and memory.read_u8(addr+1,"ROM")==b2 and
               memory.read_u8(addr+2,"ROM")==b3 and memory.read_u8(addr+3,"ROM")==b4 then
                results[#results+1] = addr
            end
            if addr % 0x40000 == 0 then yield() end
        end
    end
    return results
end

-- ---- Generic name table scanner ----
-- Tries two approaches:
--   1. Fixed-stride direct strings (e.g., 13 bytes per entry in vanilla Gen3)
--   2. Pointer table (4+ byte stride, pointer to string)

local function scanNameTable(label, anchors, verifyPairs, maxEntries, romSize)
    console.log(string.format("[%s] Scanning...", label))

    for _, anchor in ipairs(anchors) do
        local pattern = encodeGBA(anchor.name)
        if not pattern then
            console.log(string.format("[%s] Could not encode '%s', skipping", label, anchor.name))
            goto nextAnchor
        end

        console.log(string.format("[%s] Searching for '%s' (ID %d)...", label, anchor.name, anchor.id))
        local matches = findAll(pattern, romSize)
        console.log(string.format("[%s]   %d match(es)", label, #matches))

        for _, soff in ipairs(matches) do
            -- Approach 1: Direct fixed-stride string table
            -- The string IS the entry at position anchor.id * stride
            for stride = 13, 20 do
                local base = soff - (anchor.id * stride)
                if base >= 0 and base + maxEntries * stride < romSize then
                    local good = true
                    for _, vp in ipairs(verifyPairs) do
                        if vp.id ~= anchor.id then
                            local checkAddr = base + vp.id * stride
                            local name = readStr(checkAddr)
                            if name ~= vp.name then good = false; break end
                        end
                    end
                    if good then
                        return { type = "direct", base = base, stride = stride }
                    end
                end
            end

            -- Approach 2: Pointer table (string is pointed to by a table entry)
            local absAddr = 0x08000000 + soff
            local ptrs = findPtrs(absAddr, romSize)
            console.log(string.format("[%s]   %d pointer(s) to 0x%08X", label, #ptrs, absAddr))

            for _, poff in ipairs(ptrs) do
                for stride = 4, 16, 2 do
                    for nameOff = 0, math.min(stride - 4, 8), 4 do
                        local base = poff - nameOff - (anchor.id * stride)
                        if base >= 0 and base + maxEntries * stride < romSize then
                            local good = true
                            for _, vp in ipairs(verifyPairs) do
                                if vp.id ~= anchor.id then
                                    local ca = base + vp.id * stride + nameOff
                                    if ca + 4 <= romSize then
                                        local p = memory.read_u32_le(ca, "ROM")
                                        if isROMPtr(p) then
                                            local n = readStr(p & 0x1FFFFFF)
                                            if n ~= vp.name then good = false; break end
                                        else good = false; break end
                                    else good = false; break end
                                end
                            end
                            if good then
                                return { type = "pointer", base = base, stride = stride, nameOff = nameOff }
                            end
                        end
                    end
                end
            end
        end
        ::nextAnchor::
    end
    return nil
end

local function dumpDirectTable(result, maxEntries, romSize)
    local entries = {}
    for id = 0, maxEntries do
        local addr = result.base + id * result.stride
        if addr + result.stride <= romSize then
            local name = readStr(addr)
            if isValidName(name) then
                entries[#entries + 1] = { id = id, name = name }
            end
        end
    end
    return entries
end

local function dumpPointerTable(result, maxEntries, romSize)
    local entries = {}
    for id = 0, maxEntries do
        local ea = result.base + id * result.stride + result.nameOff
        if ea + 4 <= romSize then
            local ptr = memory.read_u32_le(ea, "ROM")
            if isROMPtr(ptr) then
                local name = readStr(ptr & 0x1FFFFFF)
                if isValidName(name) then
                    entries[#entries + 1] = { id = id, name = name }
                end
            end
        end
    end
    return entries
end

local function writeEntries(filename, label, result, entries)
    local f = io.open(filename, "w")
    f:write(string.format("-- %s Name Table Dump (auto-generated)\n", label))
    f:write(string.format("-- Date: %s\n", os.date("%Y-%m-%d %H:%M:%S")))
    f:write(string.format("-- Table type: %s\n", result.type))
    f:write(string.format("-- Base: ROM+0x%06X, stride=%d, %d entries\n", result.base, result.stride, #entries))
    if result.type == "direct" then
        f:write(string.format("-- gamesdb address: \"08%06X\" (stride %d bytes per name)\n", result.base, result.stride))
    elseif result.type == "pointer" then
        f:write(string.format("-- gamesdb address: \"08%06X\" (pointer table, stride %d)\n", result.base, result.stride))
    end
    f:write("--\n")
    f:write(string.format("-- %s names:\n", label))
    for _, e in ipairs(entries) do
        local safe = e.name:gsub('"', '\\"')
        f:write(string.format('  [%d] = "%s"\n', e.id, safe))
    end
    f:write(string.format("-- Total: %d entries\n", #entries))
    f:close()
end

-- ---- Main ----

local function run()
    console.clear()
    console.log("=========================================")
    console.log("  Move & Ability Name Table Dumper")
    console.log("=========================================")
    console.log("")

    local romSize = 0x01000000
    local ok, _ = pcall(function() memory.read_u8(0x01800000, "ROM") end)
    if ok then romSize = 0x02000000 end
    console.log(string.format("ROM size: %d MB", romSize / 0x100000))
    console.log("")

    -- ---- MOVE NAMES ----
    -- Anchors: universally known move IDs across all Gen3/CFRU
    local moveAnchors = {
        { id = 1,  name = "Pound" },
        { id = 10, name = "Scratch" },
        { id = 33, name = "Tackle" },
    }
    local moveVerify = {
        { id = 1,  name = "Pound" },
        { id = 10, name = "Scratch" },
        { id = 33, name = "Tackle" },
    }

    console.log("=== MOVE NAMES ===")
    local moveResult = scanNameTable("Moves", moveAnchors, moveVerify, 900, romSize)

    if moveResult then
        console.log(string.format("[Moves] TABLE FOUND! Type=%s, ROM+0x%06X, stride=%d",
            moveResult.type, moveResult.base, moveResult.stride))

        local entries
        if moveResult.type == "direct" then
            entries = dumpDirectTable(moveResult, 900, romSize)
        else
            entries = dumpPointerTable(moveResult, 900, romSize)
        end

        writeEntries(MOVE_OUTPUT, "Move", moveResult, entries)
        console.log(string.format("[Moves] Wrote %d entries to %s", #entries, MOVE_OUTPUT))
    else
        console.log("[Moves] FAILED: could not find move name table")
    end

    console.log("")

    -- ---- ABILITY NAMES ----
    local abilityAnchors = {
        { id = 22, name = "Intimidate" },
        { id = 65, name = "Overgrow" },
        { id = 1,  name = "Stench" },
    }
    local abilityVerify = {
        { id = 22, name = "Intimidate" },
        { id = 65, name = "Overgrow" },
        { id = 1,  name = "Stench" },
    }

    console.log("=== ABILITY NAMES ===")
    local abilityResult = scanNameTable("Abilities", abilityAnchors, abilityVerify, 400, romSize)

    if abilityResult then
        console.log(string.format("[Abilities] TABLE FOUND! Type=%s, ROM+0x%06X, stride=%d",
            abilityResult.type, abilityResult.base, abilityResult.stride))

        local entries
        if abilityResult.type == "direct" then
            entries = dumpDirectTable(abilityResult, 400, romSize)
        else
            entries = dumpPointerTable(abilityResult, 400, romSize)
        end

        writeEntries(ABILITY_OUTPUT, "Ability", abilityResult, entries)
        console.log(string.format("[Abilities] Wrote %d entries to %s", #entries, ABILITY_OUTPUT))
    else
        console.log("[Abilities] FAILED: could not find ability name table")
    end

    console.log("")
    console.log("=========================================")
    if moveResult or abilityResult then
        console.log("DONE! Check the output files in tools/")
        if moveResult then
            console.log("  Moves:     " .. MOVE_OUTPUT)
        end
        if abilityResult then
            console.log("  Abilities: " .. ABILITY_OUTPUT)
        end
        console.log("")
        console.log("Use the gamesdb address from each file to update")
        console.log("the moveNamesTable / abilityNameTable in gamesdb.lua")
    else
        console.log("Could not find either table in this ROM.")
    end
    console.log("=========================================")
end

local success, err = pcall(run)
if not success then
    console.log("ERROR: " .. tostring(err))
end
