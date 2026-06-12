declare const Il2Cpp: any;
declare const console: any;

const FB_W        = 270;
const FB_H        = 180;
const PANEL_W     = 0.40;
const PANEL_H     = 0.27;

const fb       = new Uint8Array(FB_W * FB_H * 4);
const nativeFb = Memory.alloc(FB_W * FB_H * 4);

// ── Framebuffer primitives ──────────────────────────────────────────────────
// LoadRawTextureData on this platform is top-down (row 0 = visual top).
// No X-flip needed — the 180°Y quad rotation is already compensated by the hand transform.
function pset(x: number, y: number, r: number, g: number, b: number, a: number) {
    if (x < 0 || x >= FB_W || y < 0 || y >= FB_H) return;
    const idx = (y * FB_W + (FB_W - 1 - x)) << 2;   // X-flip for 180°Y quad
    const inv = 255 - a;
    fb[idx]   = ((r * a + fb[idx]   * inv) / 255) | 0;
    fb[idx+1] = ((g * a + fb[idx+1] * inv) / 255) | 0;
    fb[idx+2] = ((b * a + fb[idx+2] * inv) / 255) | 0;
    fb[idx+3] = Math.min(255, fb[idx+3] + a);
}

function fillRect(x: number, y: number, w: number, h: number,
                  r: number, g: number, b: number, a: number) {
    const x0  = Math.max(0, x | 0);
    const y0  = Math.max(0, y | 0);
    const x1  = Math.min(FB_W, (x + w) | 0);
    const y1  = Math.min(FB_H, (y + h) | 0);
    const inv = 255 - a;
    for (let py = y0; py < y1; py++) {
        const rowBase = (py * FB_W) << 2;  // top-down, no flips
        for (let px = x0; px < x1; px++) {
            const idx = rowBase + ((FB_W - 1 - px) << 2);   // X-flip
            fb[idx]   = ((r * a + fb[idx]   * inv) / 255) | 0;
            fb[idx+1] = ((g * a + fb[idx+1] * inv) / 255) | 0;
            fb[idx+2] = ((b * a + fb[idx+2] * inv) / 255) | 0;
            fb[idx+3] = Math.min(255, fb[idx+3] + a);
        }
    }
}

function outlineRect(x: number, y: number, w: number, h: number,
                     r: number, g: number, b: number, a: number) {
    for (let px = x; px < x + w; px++) {
        pset(px, y,         r, g, b, a);
        pset(px, y + h - 1, r, g, b, a);
    }
    for (let py = y + 1; py < y + h - 1; py++) {
        pset(x,         py, r, g, b, a);
        pset(x + w - 1, py, r, g, b, a);
    }
}

// ── 5×7 bitmap font ─────────────────────────────────────────────────────────
// Row byte: bit 4 (0x10) = leftmost pixel, bit 0 (0x01) = rightmost.
const FONT: number[][] = [
/* ' ' 0x20 */ [0,0,0,0,0,0,0],
/* '!' 0x21 */ [4,4,4,4,4,0,4],
/* '"' 0x22 */ [10,10,0,0,0,0,0],
/* '#' 0x23 */ [10,31,10,10,31,10,0],
/* '$' 0x24 */ [4,15,20,14,5,30,4],
/* '%' 0x25 */ [24,25,2,4,8,19,3],
/* '&' 0x26 */ [12,18,12,22,17,17,14],
/* '\'' 0x27 */ [4,4,0,0,0,0,0],
/* '(' 0x28 */ [2,4,8,8,8,4,2],
/* ')' 0x29 */ [8,4,2,2,2,4,8],
/* '*' 0x2A */ [0,4,21,14,21,4,0],
/* '+' 0x2B */ [0,4,4,31,4,4,0],
/* ',' 0x2C */ [0,0,0,0,4,4,8],
/* '-' 0x2D */ [0,0,0,31,0,0,0],
/* '.' 0x2E */ [0,0,0,0,0,0,4],
/* '/' 0x2F */ [1,2,2,4,8,8,16],
/* '0' 0x30 */ [14,17,19,21,25,17,14],
/* '1' 0x31 */ [4,12,4,4,4,4,14],
/* '2' 0x32 */ [14,17,1,6,8,16,31],
/* '3' 0x33 */ [31,1,2,6,1,17,14],
/* '4' 0x34 */ [2,6,10,18,31,2,2],
/* '5' 0x35 */ [31,16,30,1,1,17,14],
/* '6' 0x36 */ [6,8,16,30,17,17,14],
/* '7' 0x37 */ [31,1,2,4,8,8,8],
/* '8' 0x38 */ [14,17,17,14,17,17,14],
/* '9' 0x39 */ [14,17,17,15,1,2,12],
/* ':' 0x3A */ [0,4,0,0,4,0,0],
/* ';' 0x3B */ [0,4,0,0,4,4,8],
/* '<' 0x3C */ [2,4,8,16,8,4,2],
/* '=' 0x3D */ [0,0,31,0,31,0,0],
/* '>' 0x3E */ [8,4,2,1,2,4,8],
/* '?' 0x3F */ [14,17,1,6,4,0,4],
/* '@' 0x40 */ [14,17,23,21,23,16,14],
/* 'A' 0x41 */ [4,10,17,17,31,17,17],
/* 'B' 0x42 */ [30,17,17,30,17,17,30],
/* 'C' 0x43 */ [14,17,16,16,16,17,14],
/* 'D' 0x44 */ [28,18,17,17,17,18,28],
/* 'E' 0x45 */ [31,16,16,30,16,16,31],
/* 'F' 0x46 */ [31,16,16,30,16,16,16],
/* 'G' 0x47 */ [14,17,16,23,17,17,15],
/* 'H' 0x48 */ [17,17,17,31,17,17,17],
/* 'I' 0x49 */ [14,4,4,4,4,4,14],
/* 'J' 0x4A */ [1,1,1,1,1,17,14],
/* 'K' 0x4B */ [17,18,20,24,20,18,17],
/* 'L' 0x4C */ [16,16,16,16,16,16,31],
/* 'M' 0x4D */ [17,27,21,21,17,17,17],
/* 'N' 0x4E */ [17,25,21,19,17,17,17],
/* 'O' 0x4F */ [14,17,17,17,17,17,14],
/* 'P' 0x50 */ [30,17,17,30,16,16,16],
/* 'Q' 0x51 */ [14,17,17,17,21,18,13],
/* 'R' 0x52 */ [30,17,17,30,20,18,17],
/* 'S' 0x53 */ [15,16,16,14,1,1,30],
/* 'T' 0x54 */ [31,4,4,4,4,4,4],
/* 'U' 0x55 */ [17,17,17,17,17,17,14],
/* 'V' 0x56 */ [17,17,17,10,10,4,4],
/* 'W' 0x57 */ [17,17,21,21,10,10,17],
/* 'X' 0x58 */ [17,17,10,4,10,17,17],
/* 'Y' 0x59 */ [17,17,10,4,4,4,4],
/* 'Z' 0x5A */ [31,1,2,4,8,16,31],
];

function drawChar(cx: number, cy: number, ch: string,
                  r: number, g: number, b: number, sc: number): number {
    const code = ch.toUpperCase().charCodeAt(0);
    if (code < 0x20 || code > 0x5A) return sc * 6;
    const glyph = FONT[code - 0x20];
    if (!glyph) return sc * 6;
    for (let row = 0; row < 7; row++) {
        const bits = glyph[row];
        if (!bits) continue;
        for (let col = 0; col < 5; col++) {
            if (!(bits & (1 << (4 - col)))) continue;   // bit 4 = leftmost pixel
            const bx = cx + col * sc;
            const by = cy + row * sc;   // row 0 = top of glyph in this font data
            for (let sy = 0; sy < sc; sy++)
                for (let sx = 0; sx < sc; sx++)
                    pset(bx + sx, by + sy, r, g, b, 255);
        }
    }
    return sc * 6;
}

function drawText(x: number, y: number, text: string,
                  r: number, g: number, b: number, sc: number = 1): number {
    let cx = x;
    for (const ch of text) cx += drawChar(cx, y, ch, r, g, b, sc);
    return cx - x;
}

// ── Colours ──────────────────────────────────────────────────────────────────
const C = {
    BG:      [12,  15,  22, 215] as const,
    PANEL:   [18,  22,  35, 230] as const,
    HEADER:  [35,  98, 210, 245] as const,
    TAB_ACT: [42, 115, 230, 245] as const,
    TAB_IN:  [28,  38,  58, 220] as const,
    BTN:     [38,  48,  72, 220] as const,
    BTN_ON:  [38, 130,  55, 230] as const,
    BTN_HOV: [60,  90, 180, 230] as const,
    BORDER:  [70, 130, 240, 120] as const,
    TEXT:    [235,240, 255, 255] as const,
    DIM:     [130,138, 158, 255] as const,
    CURSOR:  [255,200,  40, 200] as const,
};

// ── Mod registry ─────────────────────────────────────────────────────────────
interface Mod {
    name:       string;
    cat:        number;
    enabled:    boolean;
    oneshot:    boolean;
    wasEnabled: boolean;
    tick:       (() => void) | null;
}
const mods: Mod[] = [];
function addTick(cat: number, name: string, fn: () => void) {
    mods.push({ name, cat, enabled: false, oneshot: false, wasEnabled: false, tick: fn });
}
function addShot(cat: number, name: string, fn: () => void) {
    mods.push({ name, cat, enabled: false, oneshot: true,  wasEnabled: false, tick: fn });
}

const MV = 0, GR = 1, BD = 2, HA = 3, PL = 4;
const TAB_NAMES = ["MOVEMENT", "GRAVITY", "BODY", "HANDS", "PLATFORMS"] as const;

console.log("[czimgui] loading — bit-order+Y-flip+makeV3+invokeRaw+setInterval fixes");


Il2Cpp.$config.exports = {
	il2cpp_init: () => Il2Cpp.module.findExportByName("rMNVufdfVZu"),
	il2cpp_init_utf16: () => Il2Cpp.module.findExportByName("oGNDx_ScXCe"),
	il2cpp_shutdown: () => Il2Cpp.module.findExportByName("sCNueOLjBP_"),
	il2cpp_set_config_dir: () => Il2Cpp.module.findExportByName("oGLcyQfoYQC"),
	il2cpp_set_data_dir: () => Il2Cpp.module.findExportByName("OdDSfjgTtZB"),
	il2cpp_set_temp_dir: () => Il2Cpp.module.findExportByName("VVGmodnrBQp"),
	il2cpp_set_commandline_arguments: () => Il2Cpp.module.findExportByName("UkOLgcWptIN"),
	il2cpp_set_commandline_arguments_utf16: () => Il2Cpp.module.findExportByName("oaFoqZiytTd"),
	il2cpp_set_config_utf16: () => Il2Cpp.module.findExportByName("LYGDeAMFtJQ"),
	il2cpp_set_config: () => Il2Cpp.module.findExportByName("JAFNkIA_LNs"),
	il2cpp_set_memory_callbacks: () => Il2Cpp.module.findExportByName("PdGLDtKriDf"),
	il2cpp_memory_pool_set_region_size: () => Il2Cpp.module.findExportByName("WQOMYVstVMG"),
	il2cpp_memory_pool_get_region_size: () => Il2Cpp.module.findExportByName("zvQAHSPUJdV"),
	il2cpp_get_corlib: () => Il2Cpp.module.findExportByName("KHsCqaFb_Kc"),
	il2cpp_add_internal_call: () => Il2Cpp.module.findExportByName("VvpEeCpoFeR"),
	il2cpp_resolve_icall: () => Il2Cpp.module.findExportByName("hajlwDwkIa_"),
	il2cpp_alloc: () => Il2Cpp.module.findExportByName("uHCFgKlerCa"),
	il2cpp_free: () => Il2Cpp.module.findExportByName("HxfqvPwsBuF"),
	il2cpp_array_class_get: () => Il2Cpp.module.findExportByName("WfVYDjGcqXq"),
	il2cpp_array_length: () => Il2Cpp.module.findExportByName("yRFdIhgzyqs"),
	il2cpp_array_get_byte_length: () => Il2Cpp.module.findExportByName("jECsWEoepzp"),
	il2cpp_array_new: () => Il2Cpp.module.findExportByName("HoxkGJVQjNq"),
	il2cpp_array_new_specific: () => Il2Cpp.module.findExportByName("FammoeJmKyW"),
	il2cpp_array_new_full: () => Il2Cpp.module.findExportByName("FdBwlcWYWAF"),
	il2cpp_bounded_array_class_get: () => Il2Cpp.module.findExportByName("WxWbZvjuDud"),
	il2cpp_array_element_size: () => Il2Cpp.module.findExportByName("wgDiKwXUZkx"),
	il2cpp_assembly_get_image: () => Il2Cpp.module.findExportByName("diqzc_lwpjq"),
	il2cpp_class_for_each: () => Il2Cpp.module.findExportByName("KzAKeOSyPht"),
	il2cpp_class_enum_basetype: () => Il2Cpp.module.findExportByName("UkYuwpPDbjp"),
	il2cpp_class_is_inited: () => Il2Cpp.module.findExportByName("oUbSXGp_huF"),
	il2cpp_class_is_generic: () => Il2Cpp.module.findExportByName("HqUnjiNacQF"),
	il2cpp_class_is_inflated: () => Il2Cpp.module.findExportByName("bLBLyz__cUl"),
	il2cpp_class_is_assignable_from: () => Il2Cpp.module.findExportByName("YSWTzPXiNuf"),
	il2cpp_class_is_subclass_of: () => Il2Cpp.module.findExportByName("PvkXYsMvtVg"),
	il2cpp_class_has_parent: () => Il2Cpp.module.findExportByName("DqGHFOecody"),
	il2cpp_class_from_il2cpp_type: () => Il2Cpp.module.findExportByName("iFKzkqLwIgk"),
	il2cpp_class_from_name: () => Il2Cpp.module.findExportByName("ThlwdAonO_F"),
	il2cpp_class_from_system_type: () => Il2Cpp.module.findExportByName("MmtxrpWbgBp"),
	il2cpp_class_get_element_class: () => Il2Cpp.module.findExportByName("ndzLtnFFigj"),
	il2cpp_class_get_events: () => Il2Cpp.module.findExportByName("ryavgkQTksq"),
	il2cpp_class_get_fields: () => Il2Cpp.module.findExportByName("L_rSKqYVcmP"),
	il2cpp_class_get_nested_types: () => Il2Cpp.module.findExportByName("HbrTXpcsQdp"),
	il2cpp_class_get_interfaces: () => Il2Cpp.module.findExportByName("JcBeczAFiEq"),
	il2cpp_class_get_properties: () => Il2Cpp.module.findExportByName("EnwGm_jfQQj"),
	il2cpp_class_get_property_from_name: () => Il2Cpp.module.findExportByName("yrMfrcfuqTp"),
	il2cpp_class_get_field_from_name: () => Il2Cpp.module.findExportByName("wzlKWctMZMP"),
	il2cpp_class_get_methods: () => Il2Cpp.module.findExportByName("xnUYijJuNQm"),
	il2cpp_class_get_method_from_name: () => Il2Cpp.module.findExportByName("mrtTU_RDDVY"),
	il2cpp_class_get_name: () => Il2Cpp.module.findExportByName("rNPwnoakdOi"),
	il2cpp_type_get_name_chunked: () => Il2Cpp.module.findExportByName("LBPJWLITtdf"),
	il2cpp_class_get_namespace: () => Il2Cpp.module.findExportByName("vUPSYEQzzXz"),
	il2cpp_class_get_parent: () => Il2Cpp.module.findExportByName("UfexoRfySYB"),
	il2cpp_class_get_declaring_type: () => Il2Cpp.module.findExportByName("bbLERHZymBq"),
	il2cpp_class_instance_size: () => Il2Cpp.module.findExportByName("WwVxXrVqEbs"),
	il2cpp_class_num_fields: () => Il2Cpp.module.findExportByName("SUnszXoQQaQ"),
	il2cpp_class_is_valuetype: () => Il2Cpp.module.findExportByName("CkRwBcvKXTt"),
	il2cpp_class_value_size: () => Il2Cpp.module.findExportByName("wAENnFTZocz"),
	il2cpp_class_is_blittable: () => Il2Cpp.module.findExportByName("UMudoVByqDB"),
	il2cpp_class_get_flags: () => Il2Cpp.module.findExportByName("LzgkrjeRiGU"),
	il2cpp_class_is_abstract: () => Il2Cpp.module.findExportByName("gYHCsQagZOo"),
	il2cpp_class_is_interface: () => Il2Cpp.module.findExportByName("OVhzGbPTMln"),
	il2cpp_class_array_element_size: () => Il2Cpp.module.findExportByName("ZmZkcoJFsMg"),
	il2cpp_class_from_type: () => Il2Cpp.module.findExportByName("kRLGIFxBLeq"),
	il2cpp_class_get_type: () => Il2Cpp.module.findExportByName("cUGBomDAJwB"),
	il2cpp_class_get_type_token: () => Il2Cpp.module.findExportByName("DWXG_squOLB"),
	il2cpp_class_has_attribute: () => Il2Cpp.module.findExportByName("YiNAlNFEBIU"),
	il2cpp_class_has_references: () => Il2Cpp.module.findExportByName("TzdaonpHFEL"),
	il2cpp_class_is_enum: () => Il2Cpp.module.findExportByName("LKUzoutQcvh"),
	il2cpp_class_get_image: () => Il2Cpp.module.findExportByName("fCeRvWOaGbe"),
	il2cpp_class_get_assemblyname: () => Il2Cpp.module.findExportByName("xlQDjuigzlc"),
	il2cpp_class_get_rank: () => Il2Cpp.module.findExportByName("aWmcjoqAUBw"),
	il2cpp_class_get_data_size: () => Il2Cpp.module.findExportByName("qpkRpMLUyJx"),
	il2cpp_class_get_static_field_data: () => Il2Cpp.module.findExportByName("xkkiaPdMlTU"),
	il2cpp_stats_dump_to_file: () => Il2Cpp.module.findExportByName("cTpdrzaiQSj"),
	il2cpp_stats_get_value: () => Il2Cpp.module.findExportByName("JrZTEuUY_eR"),
	il2cpp_domain_get: () => Il2Cpp.module.findExportByName("KFZkHVjFbCn"),
	il2cpp_domain_assembly_open: () => Il2Cpp.module.findExportByName("tLNEnOdExYz"),
	il2cpp_domain_get_assemblies: () => Il2Cpp.module.findExportByName("KdiBlgWJPKH"),
	il2cpp_raise_exception: () => Il2Cpp.module.findExportByName("BfuSSBhMxVL"),
	il2cpp_exception_from_name_msg: () => Il2Cpp.module.findExportByName("QIzCtHgcilV"),
	il2cpp_get_exception_argument_null: () => Il2Cpp.module.findExportByName("sNp_wfhqrst"),
	il2cpp_format_exception: () => Il2Cpp.module.findExportByName("VZtlqHKLHwT"),
	il2cpp_format_stack_trace: () => Il2Cpp.module.findExportByName("EOyBMiwZDPw"),
	il2cpp_unhandled_exception: () => Il2Cpp.module.findExportByName("SrEQyosZXhZ"),
	il2cpp_native_stack_trace: () => Il2Cpp.module.findExportByName("ylqtfpyzlRn"),
	il2cpp_field_get_flags: () => Il2Cpp.module.findExportByName("OpIMORImenk"),
	il2cpp_field_get_from_reflection: () => Il2Cpp.module.findExportByName("xFVCjBSNcjk"),
	il2cpp_field_get_name: () => Il2Cpp.module.findExportByName("_DkvYgNiXiV"),
	il2cpp_field_get_parent: () => Il2Cpp.module.findExportByName("JrTsmLMgtYw"),
	il2cpp_field_get_object: () => Il2Cpp.module.findExportByName("ENpcqMtvfFM"),
	il2cpp_field_get_offset: () => Il2Cpp.module.findExportByName("gNxWMcBgVxu"),
	il2cpp_field_get_type: () => Il2Cpp.module.findExportByName("Ikdb_OIJtVE"),
	il2cpp_field_get_value: () => Il2Cpp.module.findExportByName("JBzPNMDhPVW"),
	il2cpp_field_get_value_object: () => Il2Cpp.module.findExportByName("kOAhNtslSAO"),
	il2cpp_field_has_attribute: () => Il2Cpp.module.findExportByName("PYldEkmnduH"),
	il2cpp_field_set_value: () => Il2Cpp.module.findExportByName("uVMJXDeztkw"),
	il2cpp_field_static_get_value: () => Il2Cpp.module.findExportByName("eUrcbJwe_Bc"),
	il2cpp_field_static_set_value: () => Il2Cpp.module.findExportByName("ggexGZmyofD"),
	il2cpp_field_set_value_object: () => Il2Cpp.module.findExportByName("QaYZCCFdFfB"),
	il2cpp_field_is_literal: () => Il2Cpp.module.findExportByName("DbluhBonIft"),
	il2cpp_gc_collect: () => Il2Cpp.module.findExportByName("RkpLONskKrd"),
	il2cpp_gc_collect_a_little: () => Il2Cpp.module.findExportByName("_xqYrctfDFZ"),
	il2cpp_gc_start_incremental_collection: () => Il2Cpp.module.findExportByName("ISIXaSsvTFN"),
	il2cpp_gc_disable: () => Il2Cpp.module.findExportByName("wPStgiWplIz"),
	il2cpp_gc_enable: () => Il2Cpp.module.findExportByName("QfFObsocF_e"),
	il2cpp_gc_is_disabled: () => Il2Cpp.module.findExportByName("zwucqaykNNB"),
	il2cpp_gc_set_mode: () => Il2Cpp.module.findExportByName("MttpJClgixU"),
	il2cpp_gc_get_max_time_slice_ns: () => Il2Cpp.module.findExportByName("fbcFzFViCNJ"),
	il2cpp_gc_set_max_time_slice_ns: () => Il2Cpp.module.findExportByName("ckNAYoTjMxx"),
	il2cpp_gc_is_incremental: () => Il2Cpp.module.findExportByName("RmmwTHGMEed"),
	il2cpp_gc_get_used_size: () => Il2Cpp.module.findExportByName("gCTGQJUyOFs"),
	il2cpp_gc_get_heap_size: () => Il2Cpp.module.findExportByName("CfaMbdZqSxX"),
	il2cpp_gc_wbarrier_set_field: () => Il2Cpp.module.findExportByName("AvILeDnBXNR"),
	il2cpp_gc_has_strict_wbarriers: () => Il2Cpp.module.findExportByName("UrxHFhOJvjS"),
	il2cpp_gc_set_external_allocation_tracker: () => Il2Cpp.module.findExportByName("epEtmQRwQWL"),
	il2cpp_gc_set_external_wbarrier_tracker: () => Il2Cpp.module.findExportByName("tLBlrhVYlOX"),
	il2cpp_gc_foreach_heap: () => Il2Cpp.module.findExportByName("BGpIbakjiPh"),
	il2cpp_stop_gc_world: () => Il2Cpp.module.findExportByName("QpRDUbAphJD"),
	il2cpp_start_gc_world: () => Il2Cpp.module.findExportByName("cacTSvdJVWg"),
	il2cpp_gc_alloc_fixed: () => Il2Cpp.module.findExportByName("XKbRAGuKZZE"),
	il2cpp_gc_free_fixed: () => Il2Cpp.module.findExportByName("cOlVksgzCMK"),
	il2cpp_gchandle_new: () => Il2Cpp.module.findExportByName("qkRPa_Audif"),
	il2cpp_gchandle_new_weakref: () => Il2Cpp.module.findExportByName("bSGqObtyKrw"),
	il2cpp_gchandle_get_target: () => Il2Cpp.module.findExportByName("OsrXvLSzyjs"),
	il2cpp_gchandle_free: () => Il2Cpp.module.findExportByName("siDqGKLoczK"),
	il2cpp_gchandle_foreach_get_target: () => Il2Cpp.module.findExportByName("GPLoLynUuCp"),
	il2cpp_object_header_size: () => Il2Cpp.module.findExportByName("DEnGLgXifka"),
	il2cpp_array_object_header_size: () => Il2Cpp.module.findExportByName("RFaaFbRsh_S"),
	il2cpp_offset_of_array_length_in_array_object_header: () => Il2Cpp.module.findExportByName("AzixOEZNLlg"),
	il2cpp_offset_of_array_bounds_in_array_object_header: () => Il2Cpp.module.findExportByName("WnewJrbFJDx"),
	il2cpp_allocation_granularity: () => Il2Cpp.module.findExportByName("ENiV_ntCCli"),
	il2cpp_unity_liveness_allocate_struct: () => Il2Cpp.module.findExportByName("UdMwNeHFEwk"),
	il2cpp_unity_liveness_calculation_from_root: () => Il2Cpp.module.findExportByName("rvOqfqCUHrK"),
	il2cpp_unity_liveness_calculation_from_statics: () => Il2Cpp.module.findExportByName("riHRAjeXSJM"),
	il2cpp_unity_liveness_finalize: () => Il2Cpp.module.findExportByName("NSMBjkbGqHY"),
	il2cpp_unity_liveness_free_struct: () => Il2Cpp.module.findExportByName("JmYO_ZNWHOM"),
	il2cpp_method_get_return_type: () => Il2Cpp.module.findExportByName("WDeRxAaLeDS"),
	il2cpp_method_get_declaring_type: () => Il2Cpp.module.findExportByName("DPAWHgIxwkW"),
	il2cpp_method_get_name: () => Il2Cpp.module.findExportByName("zGdwd__onfl"),
	il2cpp_method_get_from_reflection: () => Il2Cpp.module.findExportByName("jQyDXPrNlLV"),
	il2cpp_method_get_object: () => Il2Cpp.module.findExportByName("kKFatZXMYYJ"),
	il2cpp_method_is_generic: () => Il2Cpp.module.findExportByName("_nzgaYoUicW"),
	il2cpp_method_is_inflated: () => Il2Cpp.module.findExportByName("cMOWWuyIJKs"),
	il2cpp_method_is_instance: () => Il2Cpp.module.findExportByName("GCvKJsnUuBI"),
	il2cpp_method_get_param_count: () => Il2Cpp.module.findExportByName("PbsOWItWGkH"),
	il2cpp_method_get_param: () => Il2Cpp.module.findExportByName("uoFCEysLjLH"),
	il2cpp_method_get_class: () => Il2Cpp.module.findExportByName("zRoNHGzysqk"),
	il2cpp_method_has_attribute: () => Il2Cpp.module.findExportByName("CzdMgRgI_Jr"),
	il2cpp_method_get_flags: () => Il2Cpp.module.findExportByName("LAHgRPhhKaV"),
	il2cpp_method_get_token: () => Il2Cpp.module.findExportByName("fmVb_ePVYzx"),
	il2cpp_method_get_param_name: () => Il2Cpp.module.findExportByName("DhUZkRhYPrG"),
	il2cpp_property_get_flags: () => Il2Cpp.module.findExportByName("AyokonomaKy"),
	il2cpp_property_get_get_method: () => Il2Cpp.module.findExportByName("_qXFdzOBdXv"),
	il2cpp_property_get_set_method: () => Il2Cpp.module.findExportByName("ZcDgmCgvUUF"),
	il2cpp_property_get_name: () => Il2Cpp.module.findExportByName("vkIkyyeIyQx"),
	il2cpp_property_get_parent: () => Il2Cpp.module.findExportByName("IiEqjXRhclm"),
	il2cpp_object_get_class: () => Il2Cpp.module.findExportByName("swBuvBkMphH"),
	il2cpp_object_get_size: () => Il2Cpp.module.findExportByName("bDriTVdhhhu"),
	il2cpp_object_get_virtual_method: () => Il2Cpp.module.findExportByName("lkpbaDROIWp"),
	il2cpp_object_new: () => Il2Cpp.module.findExportByName("LUIRLXAAlhY"),
	il2cpp_object_unbox: () => Il2Cpp.module.findExportByName("mGnfBuiLFdt"),
	il2cpp_value_box: () => Il2Cpp.module.findExportByName("HmtaLslkfiT"),
	il2cpp_monitor_enter: () => Il2Cpp.module.findExportByName("RmirxCGaZWh"),
	il2cpp_monitor_try_enter: () => Il2Cpp.module.findExportByName("pKnEszWaHwX"),
	il2cpp_monitor_exit: () => Il2Cpp.module.findExportByName("gLIJinKQWjt"),
	il2cpp_monitor_pulse: () => Il2Cpp.module.findExportByName("WJRijpcuKYe"),
	il2cpp_monitor_pulse_all: () => Il2Cpp.module.findExportByName("zsdKGECWAgK"),
	il2cpp_monitor_wait: () => Il2Cpp.module.findExportByName("jdeioGZ_Gzo"),
	il2cpp_monitor_try_wait: () => Il2Cpp.module.findExportByName("_WNpwMEQadc"),
	il2cpp_runtime_invoke: () => Il2Cpp.module.findExportByName("JASQXFOEwkM"),
	il2cpp_runtime_invoke_convert_args: () => Il2Cpp.module.findExportByName("HFoekVxsvQd"),
	il2cpp_runtime_class_init: () => Il2Cpp.module.findExportByName("PGSpaUDoaRN"),
	il2cpp_runtime_object_init: () => Il2Cpp.module.findExportByName("gpnKFdONSaZ"),
	il2cpp_runtime_object_init_exception: () => Il2Cpp.module.findExportByName("FwhpgaIgBtx"),
	il2cpp_runtime_unhandled_exception_policy_set: () => Il2Cpp.module.findExportByName("hqRsSsykgCK"),
	il2cpp_string_length: () => Il2Cpp.module.findExportByName("MSsxSgvyulR"),
	il2cpp_string_chars: () => Il2Cpp.module.findExportByName("fyCwwgNDkpA"),
	il2cpp_string_new: () => Il2Cpp.module.findExportByName("pugqdQrOFqz"),
	il2cpp_string_new_len: () => Il2Cpp.module.findExportByName("KfDhYOOtLwo"),
	il2cpp_string_new_utf16: () => Il2Cpp.module.findExportByName("UINRfyfGbtd"),
	il2cpp_string_new_wrapper: () => Il2Cpp.module.findExportByName("IUHwpcWll_x"),
	il2cpp_string_intern: () => Il2Cpp.module.findExportByName("fZMJszMeDjy"),
	il2cpp_string_is_interned: () => Il2Cpp.module.findExportByName("FEbPYmrDiLR"),
	il2cpp_thread_current: () => Il2Cpp.module.findExportByName("RGfpHTIyPgf"),
	il2cpp_thread_attach: () => Il2Cpp.module.findExportByName("ZgVBVGLrzYK"),
	il2cpp_thread_detach: () => Il2Cpp.module.findExportByName("ikgQolMyYJa"),
	il2cpp_is_vm_thread: () => Il2Cpp.module.findExportByName("rtRidvTAfzq"),
	il2cpp_current_thread_walk_frame_stack: () => Il2Cpp.module.findExportByName("kqvfxZEnjDE"),
	il2cpp_thread_walk_frame_stack: () => Il2Cpp.module.findExportByName("tVaWZLQktU_"),
	il2cpp_current_thread_get_top_frame: () => Il2Cpp.module.findExportByName("pWkzM_rCYpE"),
	il2cpp_thread_get_top_frame: () => Il2Cpp.module.findExportByName("SOcsWeTeZLZ"),
	il2cpp_current_thread_get_frame_at: () => Il2Cpp.module.findExportByName("oXaxxtbrShy"),
	il2cpp_thread_get_frame_at: () => Il2Cpp.module.findExportByName("yEZcRvdhzbd"),
	il2cpp_current_thread_get_stack_depth: () => Il2Cpp.module.findExportByName("WTzd_gnGLFs"),
	il2cpp_thread_get_stack_depth: () => Il2Cpp.module.findExportByName("otiLagrDFNT"),
	il2cpp_override_stack_backtrace: () => Il2Cpp.module.findExportByName("MgaNAPNuYng"),
	il2cpp_type_get_object: () => Il2Cpp.module.findExportByName("hQXtbNkRCtH"),
	il2cpp_type_get_type: () => Il2Cpp.module.findExportByName("xzQ_oFfVJfM"),
	il2cpp_type_get_class_or_element_class: () => Il2Cpp.module.findExportByName("JydqJfxjTev"),
	il2cpp_type_get_name: () => Il2Cpp.module.findExportByName("CUeYHAUujlZ"),
	il2cpp_type_is_byref: () => Il2Cpp.module.findExportByName("ngnvhtcMvqz"),
	il2cpp_type_get_attrs: () => Il2Cpp.module.findExportByName("SwhOQhYXIAY"),
	il2cpp_type_equals: () => Il2Cpp.module.findExportByName("CKx_YSgZNfA"),
	il2cpp_type_get_assembly_qualified_name: () => Il2Cpp.module.findExportByName("uAgDoTXmxGd"),
	il2cpp_type_get_reflection_name: () => Il2Cpp.module.findExportByName("RMXGhDxiVBG"),
	il2cpp_type_is_static: () => Il2Cpp.module.findExportByName("CnRfYJiTIXu"),
	il2cpp_type_is_pointer_type: () => Il2Cpp.module.findExportByName("VR_ioMSQeqj"),
	il2cpp_image_get_assembly: () => Il2Cpp.module.findExportByName("qCMbNIeAVZT"),
	il2cpp_image_get_name: () => Il2Cpp.module.findExportByName("dZEBiJPVExn"),
	il2cpp_image_get_filename: () => Il2Cpp.module.findExportByName("cIonIjpgKmy"),
	il2cpp_image_get_entry_point: () => Il2Cpp.module.findExportByName("dxfQnHhTYFy"),
	il2cpp_image_get_class_count: () => Il2Cpp.module.findExportByName("VyvQjZasOPW"),
	il2cpp_image_get_class: () => Il2Cpp.module.findExportByName("OEOowyBBZOU"),
	il2cpp_capture_memory_snapshot: () => Il2Cpp.module.findExportByName("zsRevDOJJST"),
	il2cpp_free_captured_memory_snapshot: () => Il2Cpp.module.findExportByName("dxUxyDvWlwJ"),
	il2cpp_set_find_plugin_callback: () => Il2Cpp.module.findExportByName("UqLqbryCAMn"),
	il2cpp_register_log_callback: () => Il2Cpp.module.findExportByName("QdyzyqyVqX_"),
	il2cpp_debugger_set_agent_options: () => Il2Cpp.module.findExportByName("HMEHOMJUFXM"),
	il2cpp_is_debugger_attached: () => Il2Cpp.module.findExportByName("PsRiNuhoHj_"),
	il2cpp_register_debugger_agent_transport: () => Il2Cpp.module.findExportByName("WjTQnoAkEcU"),
	il2cpp_debug_foreach_method: () => Il2Cpp.module.findExportByName("kfRuwJjwiMK"),
	il2cpp_debug_get_method_info: () => Il2Cpp.module.findExportByName("RYVzwPIdnir"),
	il2cpp_unity_install_unitytls_interface: () => Il2Cpp.module.findExportByName("UkOtKKybALV"),
	il2cpp_custom_attrs_from_class: () => Il2Cpp.module.findExportByName("WUrYvAhbMTC"),
	il2cpp_custom_attrs_from_method: () => Il2Cpp.module.findExportByName("yolMBqDkFcV"),
	il2cpp_custom_attrs_from_field: () => Il2Cpp.module.findExportByName("MvnUSNOGPgL"),
	il2cpp_custom_attrs_get_attr: () => Il2Cpp.module.findExportByName("CBFsOtCsvUu"),
	il2cpp_custom_attrs_has_attr: () => Il2Cpp.module.findExportByName("QJzmZJFCyes"),
	il2cpp_custom_attrs_construct: () => Il2Cpp.module.findExportByName("PFdLsy_jhBE"),
	il2cpp_custom_attrs_free: () => Il2Cpp.module.findExportByName("hhyMhVdNmrl"),
	il2cpp_class_set_userdata: () => Il2Cpp.module.findExportByName("MSuZbibgjVb"),
	il2cpp_class_get_userdata_offset: () => Il2Cpp.module.findExportByName("Kr_kyWZLuuT"),
	il2cpp_set_default_thread_affinity: () => Il2Cpp.module.findExportByName("lRqkMKu_nkZ"),
	il2cpp_unity_set_android_network_up_state_func: () => Il2Cpp.module.findExportByName("ZrgYRAubgea"),
};


Il2Cpp.perform(() => {
    // ── Assemblies ────────────────────────────────────────────────────────────
    const asmCS  = Il2Cpp.domain.assembly("AnimalCompany").image;
    const asmUE  = Il2Cpp.domain.assembly("UnityEngine.CoreModule").image;
    const asmPhy = Il2Cpp.domain.assembly("UnityEngine.PhysicsModule").image;
    let asmXR: any = null;
    try { asmXR = Il2Cpp.domain.assembly("UnityEngine.XRModule").image; } catch {}

    // ── Classes ───────────────────────────────────────────────────────────────
    const GameObject  = asmUE.class("UnityEngine.GameObject");
    const UEObject    = asmUE.class("UnityEngine.Object");
    const Vector3     = asmUE.class("UnityEngine.Vector3");
    const Quaternion  = asmUE.class("UnityEngine.Quaternion");
    const Texture2D   = asmUE.class("UnityEngine.Texture2D");
    const Renderer    = asmUE.class("UnityEngine.Renderer");
    const Time        = asmUE.class("UnityEngine.Time");
    const Shader      = asmUE.class("UnityEngine.Shader");
    let Physics: any     = null; try { Physics     = asmPhy.class("UnityEngine.Physics");     } catch {}
    let Rigidbody: any   = null; try { Rigidbody   = asmPhy.class("UnityEngine.Rigidbody");   } catch {}
    let Collider: any    = null; try { Collider     = asmPhy.class("UnityEngine.Collider");    } catch {}
    let BoxCollider: any = null; try { BoxCollider  = asmPhy.class("UnityEngine.BoxCollider"); } catch {}
    let Camera: any      = null; try { Camera       = asmUE.class("UnityEngine.Camera");       } catch {}

    const LocoClass    = asmCS.class("AnimalCompany.GorillaLocomotion");
    let ModeSelectBtn: any = null; try { ModeSelectBtn = asmCS.class("AnimalCompany.ComputerTerminalKey"); } catch {}

    // XR input (iiboo pattern)
    let InputDevices: any = null; let CommonUsages: any = null;
    try {
        const xrImg = Il2Cpp.domain.assembly("UnityEngine.XRModule").image;
        InputDevices = xrImg.class("UnityEngine.XR.InputDevices");
        CommonUsages = xrImg.class("UnityEngine.XR.CommonUsages");
    } catch {}
    // fallback: some builds embed XR in core
    if (!InputDevices) try {
        InputDevices = asmUE.class("UnityEngine.XR.InputDevices");
        CommonUsages = asmUE.class("UnityEngine.XR.CommonUsages");
    } catch {}

    // ── Lazy game-object state (hydrated every 60 ticks) ─────────────────────
    let ACLoco:     any = null;
    let leftHandT:  any = null;
    let rightHandT: any = null;
    let headCol:    any = null;
    let rigidbody:  any = null;
    let camT:       any = null;
    let refCubeGo:  any = null;   // iiboo-style tiny cube at right-hand fingertip
    let refCubeT:   any = null;   // its transform (cursor source)

    // ── Static IL2CPP value handles ───────────────────────────────────────────
    const zeroVec   = Vector3.method("get_zero",     0).invoke();
    const upVec     = Vector3.method("get_up",       0).invoke();
    const identQuat = Quaternion.method("get_identity", 0).invoke();

    // ── Helpers ───────────────────────────────────────────────────────────────
    // makeV3: getter-mutate-invoke — safe on ARM64 (raw arrays crash for struct params)
    function makeV3(x: number, y: number, z: number): any {
        const v = Vector3.method("get_zero", 0).invoke();
        v.field("x").value = x;
        v.field("y").value = y;
        v.field("z").value = z;
        return v;
    }
    // setLocalPos/setLocalScale: same pattern for transform setters
    function setLocalPos(t: any, x: number, y: number, z: number) {
        const v = t.method("get_localPosition").invoke();
        v.field("x").value = x; v.field("y").value = y; v.field("z").value = z;
        t.method("set_localPosition").invoke(v);
    }
    function setLocalScale(t: any, x: number, y: number, z: number) {
        const v = t.method("get_localScale").invoke();
        v.field("x").value = x; v.field("y").value = y; v.field("z").value = z;
        t.method("set_localScale").invoke(v);
    }
    function eulerQ(x: number, y: number, z: number): any {
        return Quaternion.method("Euler", 3).invoke(x, y, z);
    }
    function getDT(): number {
        return Math.max(1/240, Time.method("get_deltaTime").invoke() as number);
    }
    function getVel(): any  { try { return rigidbody.method("get_velocity").invoke(); } catch { return zeroVec; } }
    function setVel(v: any) { try { rigidbody.method("set_velocity").invoke(v); } catch {} }
    // ForceMode.Force = 0 (not 5 — 5 doesn't exist)
    function addForce(v: any) { try { rigidbody.method("AddForce", 2).invoke(v, 0); } catch {} }
    function mul(v: any, s: number): any { return Vector3.method("op_Multiply",   2).invoke(v, s); }
    function add(a: any, b: any): any    { return Vector3.method("op_Addition",   2).invoke(a, b); }
    function sub(a: any, b: any): any    { return Vector3.method("op_Subtraction",2).invoke(a, b); }
    function headFwd(): any  { try { return headCol.method("get_transform").invoke().method("get_forward").invoke(); } catch { return upVec; } }
    function bodyFwd(): any  { try { return ACLoco.method("get_transform").invoke().method("get_forward").invoke(); } catch { return upVec; } }
    function rootTrans(): any { try { return ACLoco.method("get_transform").invoke(); } catch { return null; } }

    // ── XR input state (iiboo pattern: InputDevices.GetDeviceAtXRNode) ──────────
    let leftPrimary = false, leftSecondary = false, leftGrab = false, leftTriggerBtn = false;
    let rightPrimary = false, rightSecondary = false, rightGrab = false, rightTriggerBtn = false;

    // ── Platform state ────────────────────────────────────────────────────────
    let movPlatL:  any = null;   // hand platform under left  hand (Hand Platforms mod)
    let movPlatR:  any = null;   // hand platform under right hand
    let floorPlat: any = null;   // body-tracking floor slab  (Track Floor mod)

    function updateInput() {
        if (!InputDevices || !CommonUsages) return;
        try {
            const ld = InputDevices.method("GetDeviceAtXRNode",1).invoke(4);  // left = XRNode 4
            const rd = InputDevices.method("GetDeviceAtXRNode",1).invoke(5);  // right = XRNode 5
            const ob = Il2Cpp.alloc(1);
            ld.method("TryGetFeatureValue",2).invoke(CommonUsages.field("primaryButton").value,   ob); leftPrimary    = ob.readU8() !== 0;
            ld.method("TryGetFeatureValue",2).invoke(CommonUsages.field("secondaryButton").value, ob); leftSecondary  = ob.readU8() !== 0;
            ld.method("TryGetFeatureValue",2).invoke(CommonUsages.field("gripButton").value,      ob); leftGrab       = ob.readU8() !== 0;
            ld.method("TryGetFeatureValue",2).invoke(CommonUsages.field("triggerButton").value,   ob); leftTriggerBtn = ob.readU8() !== 0;
            rd.method("TryGetFeatureValue",2).invoke(CommonUsages.field("primaryButton").value,   ob); rightPrimary   = ob.readU8() !== 0;
            rd.method("TryGetFeatureValue",2).invoke(CommonUsages.field("secondaryButton").value, ob); rightSecondary = ob.readU8() !== 0;
            rd.method("TryGetFeatureValue",2).invoke(CommonUsages.field("gripButton").value,      ob); rightGrab      = ob.readU8() !== 0;
            rd.method("TryGetFeatureValue",2).invoke(CommonUsages.field("triggerButton").value,   ob); rightTriggerBtn= ob.readU8() !== 0;
        } catch(e) {}
    }

    // ── Platform helpers ──────────────────────────────────────────────────────
    function createPlatGo(x: number, y: number, z: number,
                          sx: number, sy: number, sz: number): any {
        try {
            const go = GameObject.method("CreatePrimitive").invoke(3); // Cube
            go.method("set_name").invoke(Il2Cpp.string("czimgui_plat"));
            // Solid (non-trigger) collider
            if (BoxCollider) try {
                const bc = go.method("GetComponent", 1).inflate(BoxCollider).invoke();
                if (bc && !bc.isNull()) bc.method("set_isTrigger").invoke(false);
            } catch {}
            // Shader (colour stays default white — visible enough)
            try {
                const rend = go.method("GetComponent", 1).inflate(Renderer).invoke();
                if (rend && !rend.isNull()) {
                    const mat = rend.method("get_material").invoke();
                    const sh = findShader();
                    if (sh) try { mat.method("set_shader").invoke(sh); } catch {}
                }
            } catch {}
            const t = go.method("get_transform").invoke();
            t.method("set_position").invoke(makeV3(x, y, z));
            setLocalScale(t, sx, sy, sz);
            try { UEObject.method("DontDestroyOnLoad").invoke(go); } catch {}
            return go;
        } catch(e) { console.log("[czimgui] createPlatGo err: " + e); return null; }
    }
    function destroyPlatGo(go: any) {
        try { if (go && !go.isNull()) UEObject.method("Destroy", 1).invoke(go); } catch {}
    }

    // ── Mods ─────────────────────────────────────────────────────────────────

    // Movement
    addShot(MV, "Speed Boost (2.25x)", () => {
        try { ACLoco.field("jumpMultiplier").value = 2.25; ACLoco.field("maxJumpSpeed").value = 999.0; } catch {}
    });
    addShot(MV, "BIG Speed (7.5x)", () => {
        try { ACLoco.field("jumpMultiplier").value = 7.5;  ACLoco.field("maxJumpSpeed").value = 999.0; } catch {}
    });
    addShot(MV, "Fix Speed", () => {
        try { ACLoco.field("jumpMultiplier").value = 1.1;  ACLoco.field("maxJumpSpeed").value = 6.5;   } catch {}
    });
    addTick(MV, "Fly (R-Trigger)", () => {
        if (!rightTriggerBtn) return;
        const t = rootTrans(); if (!t) return;
        t.method("set_position").invoke(add(t.method("get_position").invoke(), mul(headFwd(), getDT() * 12.0)));
        setVel(zeroVec);
    });
    addTick(MV, "Bark Fly (L-Trigger)", () => {
        if (!leftTriggerBtn) return;
        addForce(mul(headFwd(), 245.0 * getDT()));
    });
    addTick(MV, "Bounce (L-Trigger)", () => {
        if (!leftTriggerBtn) return;
        addForce(mul(upVec, 120.0 * getDT()));
    });
    addTick(MV, "Up+Down (Triggers)", () => {
        const dt = getDT(); const vel = getVel();
        if (rightTriggerBtn) setVel(add(vel, mul(upVec,  dt * 30.0)));
        if (leftTriggerBtn)  setVel(sub(vel, mul(upVec,  dt * 30.0)));
    });
    addTick(MV, "Gorilla Car", () => {
        const dt = getDT(); const vel = getVel(); const fwd = bodyFwd();
        if (rightTriggerBtn) setVel(add(vel, mul(fwd,  dt * 30.0)));
        if (leftTriggerBtn)  setVel(sub(vel, mul(fwd,  dt * 30.0)));
    });
    addTick(MV, "Speed Boost Loop", () => {
        try { ACLoco.field("jumpMultiplier").value = 3.0; } catch {}
    });

    // Gravity — makeV3 required; raw arrays crash IL2CPP struct params on ARM64
    addShot(GR, "Zero Gravity",   () => { try { Physics.method("set_gravity").invoke(makeV3(0,  0,    0)); } catch(e) { console.log("[czimgui] gravity: "+e); } });
    addShot(GR, "Low Gravity",    () => { try { Physics.method("set_gravity").invoke(makeV3(0, -5,    0)); } catch(e) { console.log("[czimgui] gravity: "+e); } });
    addShot(GR, "High Gravity",   () => { try { Physics.method("set_gravity").invoke(makeV3(0, -50,   0)); } catch(e) { console.log("[czimgui] gravity: "+e); } });
    addShot(GR, "Normal Gravity", () => { try { Physics.method("set_gravity").invoke(makeV3(0, -9.81, 0)); } catch(e) { console.log("[czimgui] gravity: "+e); } });

    // Body
    addTick(BD, "Freeze Movement", () => {
        try { ACLoco.method("set_ignoreLeftHandMovement").invoke(true);  ACLoco.method("set_ignoreRightHandMovement").invoke(true);  } catch {}
    });
    addShot(BD, "Unfreeze", () => {
        try { ACLoco.method("set_ignoreLeftHandMovement").invoke(false); ACLoco.method("set_ignoreRightHandMovement").invoke(false); } catch {}
    });
    addTick(BD, "Headless", () => {
        try { setLocalScale(headCol.method("get_transform").invoke(), 0, 0, 0); } catch {}
    });
    addShot(BD, "Fix Head", () => {
        try { setLocalScale(headCol.method("get_transform").invoke(), 1, 1, 1); } catch {}
    });
    addTick(BD, "Backwards Head", () => {
        try { headCol.method("get_transform").invoke().method("set_localRotation").invoke(eulerQ(180.0, 0.0, 0.0)); } catch {}
    });
    addShot(BD, "Fix Head Rotation", () => {
        try { headCol.method("get_transform").invoke().method("set_localRotation").invoke(identQuat); } catch {}
    });

    // Hands
    addTick(HA, "Long Arms",      () => { try { ACLoco.field("baseMaxArmLength").value = 999.9; } catch {} });
    addShot(HA, "Fix Arms",       () => { try { ACLoco.field("baseMaxArmLength").value = 1.5;   } catch {} });
    addTick(HA, "Slippery Hands", () => { try { ACLoco.method("set_handFrictionMultiplier").invoke(0.0); } catch {} });
    addShot(HA, "Fix Friction",   () => { try { ACLoco.method("set_handFrictionMultiplier").invoke(1.0); } catch {} });
    addTick(HA, "Arm Reach x5",  () => { try { ACLoco.field("baseMaxArmLength").value = 7.5;   } catch {} });
    addTick(HA, "Arm Reach x100",() => { try { ACLoco.field("baseMaxArmLength").value = 150;   } catch {} });

    // Platforms (ported from iiboo createSolidPlatform pattern)
    addTick(PL, "Hand Platforms", () => {
        // Left hand — hold grip to push/move a slab below it
        if (leftGrab && leftHandT && !leftHandT.isNull()) {
            try {
                const p  = leftHandT.method("get_position").invoke();
                const px = p.field("x").value as number;
                const py = (p.field("y").value as number) - 0.18;
                const pz = p.field("z").value as number;
                if (!movPlatL || movPlatL.isNull()) {
                    movPlatL = createPlatGo(px, py, pz, 0.24, 0.025, 0.24);
                } else {
                    movPlatL.method("get_transform").invoke()
                            .method("set_position").invoke(makeV3(px, py, pz));
                }
            } catch {}
        } else { destroyPlatGo(movPlatL); movPlatL = null; }
        // Right hand
        if (rightGrab && rightHandT && !rightHandT.isNull()) {
            try {
                const p  = rightHandT.method("get_position").invoke();
                const px = p.field("x").value as number;
                const py = (p.field("y").value as number) - 0.18;
                const pz = p.field("z").value as number;
                if (!movPlatR || movPlatR.isNull()) {
                    movPlatR = createPlatGo(px, py, pz, 0.24, 0.025, 0.24);
                } else {
                    movPlatR.method("get_transform").invoke()
                            .method("set_position").invoke(makeV3(px, py, pz));
                }
            } catch {}
        } else { destroyPlatGo(movPlatR); movPlatR = null; }
    });
    addShot(PL, "Clear Hands", () => {
        destroyPlatGo(movPlatL); movPlatL = null;
        destroyPlatGo(movPlatR); movPlatR = null;
    });
    addShot(PL, "Floor Here", () => {
        if (!ACLoco || ACLoco.isNull()) return;
        try {
            const p = ACLoco.method("get_transform").invoke().method("get_position").invoke();
            createPlatGo(
                p.field("x").value as number,
                (p.field("y").value as number) - 0.10,
                p.field("z").value as number,
                3.0, 0.05, 3.0
            );
        } catch(e) { console.log("[czimgui] FloorHere: " + e); }
    });
    addTick(PL, "Track Floor", () => {
        // Large slab that follows player body at foot level
        if (!ACLoco || ACLoco.isNull()) { destroyPlatGo(floorPlat); floorPlat = null; return; }
        try {
            const p  = ACLoco.method("get_transform").invoke().method("get_position").invoke();
            const px = p.field("x").value as number;
            const py = (p.field("y").value as number) - 0.10;
            const pz = p.field("z").value as number;
            if (!floorPlat || floorPlat.isNull()) {
                floorPlat = createPlatGo(px, py, pz, 3.0, 0.05, 3.0);
            } else {
                floorPlat.method("get_transform").invoke()
                         .method("set_position").invoke(makeV3(px, py, pz));
            }
        } catch {}
    });
    addShot(PL, "Clear Floor", () => {
        destroyPlatGo(floorPlat); floorPlat = null;
    });

    // ── Texture upload ────────────────────────────────────────────────────────
    let _doUpload: (() => void) | null = null;
    let _dirty = true;

    function initUpload(tex: any) {
        let applyFn: () => void;
        try {
            const m = tex.method("Apply", 2);
            applyFn = () => m.invoke(false, false);
        } catch {
            try {
                const m = tex.method("Apply", 0);
                applyFn = () => m.invoke();
            } catch(e) {
                console.log("[czimgui] no Apply method: " + e);
                return;
            }
        }

        // Primary: LoadRawTextureData(IntPtr ptr, int size)
        try {
            const loadRaw = tex.method("LoadRawTextureData", 2);
            _doUpload = () => {
                nativeFb.writeByteArray(fb.buffer as ArrayBuffer);
                loadRaw.invoke(nativeFb, FB_W * FB_H * 4);
                applyFn();
            };
            console.log("[czimgui] upload: LoadRawTextureData(ptr, size) ok");
            return;
        } catch(e) { console.log("[czimgui] LoadRawTextureData(2) unavail: " + e); }

        // Fallback: LoadRawTextureData(byte[]) 1-arg
        try {
            const loadRaw = tex.method("LoadRawTextureData", 1);
            _doUpload = () => {
                nativeFb.writeByteArray(fb.buffer as ArrayBuffer);
                loadRaw.invoke(nativeFb);
                applyFn();
            };
            console.log("[czimgui] upload: LoadRawTextureData(1) ok");
            return;
        } catch(e) { console.log("[czimgui] LoadRawTextureData(1) unavail: " + e); }

        console.log("[czimgui] ERROR: no upload path — panel will be blank");
    }

    function uploadFb() {
        if (!_doUpload || !_dirty) return;
        renderFrame();
        _dirty = false;
        try { _doUpload(); } catch(e) { console.log("[czimgui] upload err: " + e); }
    }

    // ── Panel objects ─────────────────────────────────────────────────────────
    let quadGo:   any = null;
    let panelTex: any = null;
    let panelMat: any = null;

    function findShader(): any {
        for (const n of ["Unlit/Texture","Universal Render Pipeline/Unlit","Sprites/Default","UI/Default","Standard"]) {
            try {
                const s = Shader.method("Find").invoke(Il2Cpp.string(n));
                if (s && !s.isNull()) { console.log("[czimgui] shader: " + n); return s; }
            } catch {}
        }
        return null;
    }

    function initPanel(attachT: any) {
        if (quadGo) return;
        if (!attachT) return;
        console.log("[czimgui] initPanel");

        try {
            const old = GameObject.method("Find", 1).invoke(Il2Cpp.string("czimgui_panel"));
            if (old && !old.isNull()) UEObject.method("Destroy", 1).invoke(old);
        } catch {}

        // Texture (RGBA32 = format 4)
        try {
            const whiteTex = Texture2D.method("get_whiteTexture").invoke();
            panelTex = UEObject.method("Instantiate", 1).invoke(whiteTex);
            let resized = false;
            try { panelTex.method("Reinitialize", 4).invoke(FB_W, FB_H, 4, false); resized = true; } catch {}
            if (!resized) {
                try { panelTex.method("Resize", 4).invoke(FB_W, FB_H, 4, false); resized = true; } catch {}
            }
            if (!resized) console.log("[czimgui] WARNING: texture resize failed");
            try { panelTex.method("set_filterMode").invoke(0); } catch {}  // Point filtering
            try { UEObject.method("DontDestroyOnLoad").invoke(panelTex); } catch {}
        } catch(e) { console.log("[czimgui] tex failed: " + e); return; }

        // Quad (PrimitiveType.Quad = 5)
        try {
            quadGo = GameObject.method("CreatePrimitive").invoke(5);
            quadGo.method("set_name").invoke(Il2Cpp.string("czimgui_panel"));
            quadGo.method("SetActive").invoke(false);

            // Disable mesh collider, add trigger box
            try {
                const col = quadGo.method("GetComponent", 1).inflate(Collider).invoke();
                if (col && !col.isNull()) col.method("set_enabled").invoke(false);
            } catch {}
            if (BoxCollider) {
                try {
                    const bc = quadGo.method("AddComponent", 1).inflate(BoxCollider).invoke();
                    bc.method("set_isTrigger").invoke(true);
                    const sz = makeV3(1.0, 1.0, 0.02);
                    bc.method("set_size").invoke(sz);
                    if (ModeSelectBtn) {
                        quadGo.method("AddComponent", 1).inflate(ModeSelectBtn).invoke();
                        quadGo.method("set_name").invoke(Il2Cpp.string("@czimgui_panel"));
                    }
                } catch(e) { console.log("[czimgui] trigger setup err: " + e); }
            }

            // Material + shader + texture
            const rend = quadGo.method("GetComponent", 1).inflate(Renderer).invoke();
            if (rend && !rend.isNull()) {
                panelMat = rend.method("get_material").invoke();
                const sh = findShader();
                if (sh) try { panelMat.method("set_shader").invoke(sh); } catch {}
                try { panelMat.method("set_mainTexture").invoke(panelTex); } catch {}
                // URP BaseMap fallback
                try {
                    const basemapId = asmUE.class("UnityEngine.Shader").method("PropertyToID",1).invoke(Il2Cpp.string("_BaseMap"));
                    panelMat.method("SetTexture",2).invoke(basemapId, panelTex);
                } catch {}
            }

            // Parent to left hand
            const qt = quadGo.method("get_transform").invoke();
            qt.method("SetParent", 2).invoke(attachT, false);
            setLocalPos(qt, 0.0, 0.10, 0.04);
            qt.method("set_localRotation").invoke(eulerQ(65.0, 180.0, 0.0));
            setLocalScale(qt, PANEL_W, PANEL_H, 1.0);
            try { UEObject.method("DontDestroyOnLoad").invoke(quadGo); } catch {}
            console.log("[czimgui] quad ready");
        } catch(e) { console.log("[czimgui] quad failed: " + e); return; }

        initUpload(panelTex);

        // ── iiboo reference cube: tiny trigger cube at right-hand fingertip ──
        // (same pattern as iiboo's renderReference — 0.01³, kinematic RB, layer 2)
        if (rightHandT && !rightHandT.isNull()) {
            try {
                const old = GameObject.method("Find", 1).invoke(Il2Cpp.string("czimgui_ref"));
                if (old && !old.isNull()) UEObject.method("Destroy", 1).invoke(old);
            } catch {}
            try {
                refCubeGo = GameObject.method("CreatePrimitive").invoke(3); // Cube = 3
                refCubeGo.method("set_name").invoke(Il2Cpp.string("czimgui_ref"));
                refCubeGo.method("set_layer").invoke(2);
                // Disable renderer so it's invisible
                try {
                    const r = refCubeGo.method("GetComponent",1).inflate(Renderer).invoke();
                    if (r && !r.isNull()) r.method("set_enabled").invoke(false);
                } catch {}
                // Make collider a trigger
                if (BoxCollider) {
                    try {
                        const bc = refCubeGo.method("GetComponent",1).inflate(BoxCollider).invoke();
                        if (bc && !bc.isNull()) bc.method("set_isTrigger").invoke(true);
                    } catch {}
                }
                // Kinematic rigidbody (same as iiboo)
                if (Rigidbody) {
                    try {
                        const rb = refCubeGo.method("AddComponent",1).inflate(Rigidbody).invoke();
                        rb.method("set_isKinematic").invoke(true);
                    } catch {}
                }
                refCubeT = refCubeGo.method("get_transform").invoke();
                refCubeT.method("SetParent", 2).invoke(rightHandT, false);
                setLocalPos(refCubeT, 0.01, -0.117, 0.05);   // fingertip offset (iiboo values)
                setLocalScale(refCubeT, 0.01, 0.01, 0.01);
                try { UEObject.method("DontDestroyOnLoad").invoke(refCubeGo); } catch {}
                console.log("[czimgui] ref cube ready");
            } catch(e) { console.log("[czimgui] ref cube failed: " + e); }
        }

        // Flash red to confirm texture pipeline
        fb.fill(0);
        for (let i = 0; i < fb.length; i += 4) { fb[i] = 200; fb[i+3] = 255; }
        if (_doUpload) { try { _doUpload(); } catch {} }
        console.log("[czimgui] panel init complete");
    }

    // ── Projection (right-hand world pos → panel UV → pixel) ─────────────────
    let _projErrLogged = false;
    function project(panelTransform: any, rhPos: any): { x: number; y: number; over: boolean; touching: boolean } {
        try {
            const local = panelTransform.method("InverseTransformPoint", 1).invoke(rhPos);
            const lx = local.field("x").value as number;
            const ly = local.field("y").value as number;
            const lz = local.field("z").value as number;
            const u  = 0.5 + lx;   // X-flip in texture, so cursor direction matches
            const v  = 0.5 - ly;
            const over     = u >= -0.05 && u <= 1.05 && v >= -0.05 && v <= 1.05;
            const touching = over && Math.abs(lz) < 0.20;  // hand within ~20 cm of panel surface
            return { x: (u * FB_W) | 0, y: (v * FB_H) | 0, over, touching };
        } catch(e) {
            if (!_projErrLogged) { console.log("[czimgui] project err: " + e); _projErrLogged = true; }
            return { x: FB_W >> 1, y: FB_H >> 1, over: false, touching: false };
        }
    }


    // Gaze cursor: ray from camera forward intersects panel plane
    function gazeProject(panelT: any): { x: number, y: number, over: boolean, touching: boolean } {
        if (!camT || camT.isNull()) return { x: FB_W>>1, y: FB_H>>1, over: false, touching: false };
        try {
            const pos = camT.method("get_position").invoke();
            const fwd = camT.method("get_forward").invoke();
            const lp  = panelT.method("InverseTransformPoint", 1).invoke(pos);
            const ld  = panelT.method("InverseTransformDirection", 1).invoke(fwd);
            const lpz = lp.field("z").value as number;
            const ldz = ld.field("z").value as number;
            if (Math.abs(ldz) < 0.0001) return { x: FB_W>>1, y: FB_H>>1, over: false, touching: false };
            const t   = -lpz / ldz;
            if (t < 0.01 || t > 8.0) return { x: FB_W>>1, y: FB_H>>1, over: false, touching: false };
            const ix  = (lp.field("x").value as number) + (ld.field("x").value as number) * t;
            const iy  = (lp.field("y").value as number) + (ld.field("y").value as number) * t;
            const u   = 0.5 + ix;
            const v   = 0.5 - iy;
            const over = u >= -0.1 && u <= 1.1 && v >= -0.1 && v <= 1.1;
            return { x: (u * FB_W)|0, y: (v * FB_H)|0, over, touching: false };
        } catch(e) {
            return { x: FB_W>>1, y: FB_H>>1, over: false, touching: false };
        }
    }

    // ── Render constants / state ──────────────────────────────────────────────
    const ITEMS_PER_PAGE = 6;
    const TITLE_H  = 20;   // title bar height
    const SEP_Y    = 21;   // horizontal separator line y
    const CAT_Y    = 26;   // category label top
    const CAT_H    = 14;   // category label height
    const BODY_Y   = 42;   // button list starts here
    const BTN_H    = 19;   // button height
    const BTN_GAP  = 2;    // gap between buttons
    const BTN_X    = 6;    // button left edge
    const BTN_W_C  = FB_W - 24;   // button width (246px)
    const SB_X     = FB_W - 10;   // scrollbar centre x (260)

    let curTab    = 0;
    let scrollOff = 0;
    let cursorX   = FB_W >> 1;
    let cursorY   = FB_H >> 1;

    function renderFrame() {
        // Background
        fillRect(0, 0, FB_W, FB_H, 6, 6, 9, 255);

        // ── Title bar ─────────────────────────────────────────────
        fillRect(0, 0, FB_W, TITLE_H, 10, 10, 15, 255);
        // "II BOO" centred: 6 chars × 12px (scale 2) = 72px → x = (270−72)/2 = 99
        drawText(99, 3, "II BOO", 235, 235, 255, 2);

        // ── Horizontal separator: line with square-dot endpoints ──
        fillRect(3, SEP_Y, 3, 3, 170, 170, 195, 255);
        for (let x = 8; x < FB_W - 7; x++) pset(x, SEP_Y + 1, 100, 100, 130, 180);
        fillRect(FB_W - 7, SEP_Y, 3, 3, 170, 170, 195, 255);

        // ── Category label (click left/right half to cycle tabs) ──
        fillRect(0, CAT_Y, FB_W, CAT_H, 18, 20, 28, 245);
        drawText(4, CAT_Y + 3, "<", 110, 110, 145, 1);
        drawText(FB_W - 11, CAT_Y + 3, ">", 110, 110, 145, 1);
        const catName = TAB_NAMES[curTab];
        const catNameX = (FB_W - catName.length * 6) >> 1;
        drawText(catNameX, CAT_Y + 3, catName, 210, 215, 255, 1);

        // ── Button list ───────────────────────────────────────────
        const catMods = mods.filter(m => m.cat === curTab);
        const end = Math.min(scrollOff + ITEMS_PER_PAGE, catMods.length);
        for (let i = scrollOff; i < end; i++) {
            const m  = catMods[i];
            const by = BODY_Y + (i - scrollOff) * (BTN_H + BTN_GAP);
            const hov = cursorX >= BTN_X && cursorX < BTN_X + BTN_W_C &&
                        cursorY >= by    && cursorY < by + BTN_H;
            const bg = hov ? C.BTN_HOV : (m.enabled ? C.BTN_ON : C.BTN);
            fillRect(BTN_X, by, BTN_W_C, BTN_H, bg[0], bg[1], bg[2], bg[3]);
            outlineRect(BTN_X, by, BTN_W_C, BTN_H, C.BORDER[0], C.BORDER[1], C.BORDER[2], 80);
            // Status pip (green = on, dim = off)
            const pip = m.enabled ? [70, 220, 80] : [50, 55, 75];
            fillRect(BTN_X + 3, by + 5, 4, BTN_H - 10, pip[0], pip[1], pip[2], 255);
            drawText(BTN_X + 11, by + 6, m.name, C.TEXT[0], C.TEXT[1], C.TEXT[2], 1);
            if (m.oneshot) drawText(BTN_X + BTN_W_C - 18, by + 6, "1X", C.DIM[0], C.DIM[1], C.DIM[2], 1);
        }

        // ── Right-side vertical scrollbar ─────────────────────────
        const SB_TOP = BODY_Y;
        const SB_BOT = FB_H - 4;
        const SB_HT  = SB_BOT - SB_TOP;
        fillRect(SB_X - 1, SB_TOP, 3, 3, 160, 160, 185, 220);
        fillRect(SB_X - 1, SB_BOT - 3, 3, 3, 160, 160, 185, 220);
        for (let y = SB_TOP + 4; y < SB_BOT - 3; y++) pset(SB_X, y, 80, 80, 110, 150);
        if (catMods.length > ITEMS_PER_PAGE) {
            const thumbH = Math.max(6, (SB_HT * ITEMS_PER_PAGE / catMods.length) | 0);
            const thumbY = SB_TOP + 4 +
                (((SB_HT - 8 - thumbH) * scrollOff / (catMods.length - ITEMS_PER_PAGE)) | 0);
            fillRect(SB_X - 1, thumbY, 3, thumbH, 170, 175, 210, 220);
        }

        // ── Cursor dot ─────────────────────────────────────────────
        fillRect(cursorX - 2, cursorY - 2, 5, 5, C.CURSOR[0], C.CURSOR[1], C.CURSOR[2], C.CURSOR[3]);
        pset(cursorX, cursorY, 255, 255, 255, 255);
    }

    // ── Click handler ─────────────────────────────────────────────────────────
    function handleClick() {
        // Category label: left half → prev tab, right half → next tab
        if (cursorY >= CAT_Y && cursorY < CAT_Y + CAT_H) {
            if (cursorX < (FB_W >> 1)) {
                curTab = (curTab + TAB_NAMES.length - 1) % TAB_NAMES.length;
            } else {
                curTab = (curTab + 1) % TAB_NAMES.length;
            }
            scrollOff = 0; return;
        }

        // Button list
        const catMods = mods.filter(m => m.cat === curTab);
        for (let i = scrollOff; i < Math.min(scrollOff + ITEMS_PER_PAGE, catMods.length); i++) {
            const by = BODY_Y + (i - scrollOff) * (BTN_H + BTN_GAP);
            if (cursorY >= by && cursorY < by + BTN_H &&
                cursorX >= BTN_X && cursorX < BTN_X + BTN_W_C) {
                const m = catMods[i];
                console.log("[czimgui] click: " + m.name + (m.oneshot ? " [1x]" : (m.enabled ? " →OFF" : " →ON")));
                if (m.oneshot) { try { m.tick?.(); } catch(e) { console.log("[czimgui] 1x err: " + e); } }
                else           { m.enabled = !m.enabled; }
                return;
            }
        }
    }

    // ── Controller transform fallback lookup ──────────────────────────────────
    let leftCtrlT:  any = null;
    let rightCtrlT: any = null;

    function findCtrlT(names: string[]): any {
        for (const n of names) {
            try {
                const g = GameObject.method("Find", 1).invoke(Il2Cpp.string(n));
                if (g && !g.isNull()) return g.method("get_transform").invoke();
            } catch {}
        }
        return null;
    }

    // ── Main tick ─────────────────────────────────────────────────────────────
    let menuOpen   = false;
    let togglePrev = false;
    let animProg   = 0.0;
    let prevClick  = false;
    let inited     = false;
    let _dbgTick   = 0;
    // Cached projection — updated at 50 Hz, read at 100 Hz for click detection
    let proj = { x: FB_W>>1, y: FB_H>>1, over: false, touching: false };

    function tick() {
        _dbgTick++;

        // Lazy hydration every 60 ticks
        if (_dbgTick % 60 === 0) {
            // Find ACLoco instance
            if (!ACLoco || ACLoco.isNull()) {
                for (const n of ["instance","Instance","_instance"]) {
                    try { const v = LocoClass.field(n).value; if (v && !v.isNull()) { ACLoco = v; break; } } catch {}
                }
                if (!ACLoco || ACLoco.isNull()) {
                    try { ACLoco = LocoClass.method("get_Instance",0).invoke(); } catch {}
                }
            }
            // Find hand/head transforms from ACLoco
            if (ACLoco && !ACLoco.isNull()) {
                if (!leftHandT || leftHandT.isNull()) {
                    for (const n of ["leftHandTransform","leftHandAnchor","leftHand"]) {
                        try { const v = ACLoco.field(n).value; if (v && !v.isNull()) { leftHandT = v; break; } } catch {}
                    }
                }
                if (!rightHandT || rightHandT.isNull()) {
                    for (const n of ["rightHandTransform","rightHandAnchor","rightHand"]) {
                        try { const v = ACLoco.field(n).value; if (v && !v.isNull()) { rightHandT = v; break; } } catch {}
                    }
                }
                if (!headCol || headCol.isNull()) {
                    for (const n of ["headCollider","head","headTransform"]) {
                        try { const v = ACLoco.field(n).value; if (v && !v.isNull()) { headCol = v; break; } } catch {}
                    }
                }
                if (!rigidbody || rigidbody.isNull()) {
                    for (const n of ["bodyCollider","body"]) {
                        try { const bc = ACLoco.field(n).value; if (bc && !bc.isNull()) { rigidbody = bc.method("get_attachedRigidbody").invoke(); break; } } catch {}
                    }
                    if (!rigidbody || rigidbody.isNull()) {
                        try { rigidbody = ACLoco.method("get_component",1).inflate(Rigidbody).invoke(); } catch {}
                    }
                }
            }
            // Camera.main — panel attachment + mouse/gaze source
            if (Camera) {
                try {
                    const cam = Camera.method("get_main",0).invoke();
                    if (cam && !cam.isNull()) {
                        const ct = cam.method("get_transform").invoke();
                        if (!camT || camT.isNull()) camT = ct;
                        if (!leftHandT || leftHandT.isNull()) leftHandT = ct;
                    }
                } catch {}
            }
            // Controller transform lookup
            if (!leftCtrlT)  leftCtrlT  = findCtrlT(["LeftHand Controller","LeftHandAnchor","Left Controller"]);
            if (!rightCtrlT) rightCtrlT = findCtrlT(["RightHand Controller","RightHandAnchor","Right Controller"]);
        }

        if (!leftHandT || !rightHandT) return;

        // ── Full-rate section (100 Hz): input, mods, toggle, click ────────────
        updateInput();

        for (const m of mods) {
            if (!m.oneshot && m.enabled && m.tick) try { m.tick(); } catch {}
        }

        if (!inited) { initPanel(leftCtrlT || leftHandT); inited = true; }
        if (!quadGo) return;

        // Toggle menu — full rate so button press is never missed
        const toggleNow = leftSecondary || leftGrab;
        if (toggleNow && !togglePrev) {
            menuOpen = !menuOpen;
            _dirty = true;
            // Reset stale proj so it can't fire a spurious click the moment menu opens
            proj = { x: FB_W>>1, y: FB_H>>1, over: false, touching: false };
            prevClick = false;
        }
        togglePrev = toggleNow;

        // Reset click state while menu is closed (keeps proj clean for next open)
        if (!menuOpen) { proj = { x: FB_W>>1, y: FB_H>>1, over: false, touching: false }; prevClick = false; }

        // Click detection at full rate using cached proj (updated below at 50 Hz)
        const inputActive = rightTriggerBtn || proj.touching;
        const clicking = proj.over && inputActive;
        if (clicking && !prevClick) { handleClick(); _dirty = true; }
        prevClick = clicking;

        // ── 50 Hz section (every 2nd tick): cursor projection + texture upload ──
        // InverseTransformPoint + LoadRawTextureData are the expensive calls.
        // 50 Hz eliminates lag while keeping cursor smooth enough for VR.
        if (_dbgTick % 2 !== 0) return;

        // Animate open/close
        const dt  = Math.max(1/240, Time.method("get_unscaledDeltaTime").invoke() as number) * 2;
        const spd = 1.0 / 0.18;
        if (menuOpen) animProg = Math.min(1.0, animProg + dt * spd);
        else          animProg = Math.max(0.0, animProg - dt * spd);

        const visible = animProg > 0.001;
        quadGo.method("SetActive").invoke(visible);
        if (!visible) return;

        const ease = 1.0 - (1.0 - animProg) ** 3;
        const qt   = quadGo.method("get_transform").invoke();
        setLocalPos(qt, 0.0, 0.10, 0.04);
        qt.method("set_localRotation").invoke(eulerQ(65.0, 180.0, 0.0));
        setLocalScale(qt, PANEL_W * ease, PANEL_H * ease, 1.0);

        if (!menuOpen) return;

        // Update cursor from ref cube position
        const cursorSrc = (refCubeT && !refCubeT.isNull()) ? refCubeT
                        : (rightCtrlT || rightHandT);
        if (cursorSrc && !cursorSrc.isNull()) {
            try { proj = project(qt, cursorSrc.method("get_position").invoke()); } catch {}
        }

        const nx = Math.max(0, Math.min(FB_W - 1, proj.x));
        const ny = Math.max(0, Math.min(FB_H - 1, proj.y));
        if (Math.abs(nx - cursorX) > 1 || Math.abs(ny - cursorY) > 1) _dirty = true;
        cursorX = nx; cursorY = ny;

        // Scroll near list edges
        const catMods = mods.filter(m => m.cat === curTab);
        if (proj.over && inputActive && !prevClick) {
            if (cursorY < BODY_Y + 14 && scrollOff > 0)
                { scrollOff--; _dirty = true; }
            if (cursorY > FB_H - 14 && scrollOff + ITEMS_PER_PAGE < catMods.length)
                { scrollOff++; _dirty = true; }
        }

        uploadFb();
    }

    // ── Hook: LateUpdate — multi-class fallback + setInterval last resort ─────
    // GorillaLocomotion doesn't always expose LateUpdate/Update in its own method table.
    let LateUpdateM: any = null;
    const hookCandidates: Array<[any, string]> = [
        [LocoClass, "LateUpdate"],
        [LocoClass, "Update"],
        [LocoClass, "FixedUpdate"],
    ];
    if (ModeSelectBtn) {
        hookCandidates.push([ModeSelectBtn, "Update"]);
        hookCandidates.push([ModeSelectBtn, "LateUpdate"]);
    }
    if (Camera) {
        hookCandidates.push([Camera, "Update"]);
        hookCandidates.push([Camera, "LateUpdate"]);
    }
    for (const [klass, name] of hookCandidates) {
        try {
            LateUpdateM = klass.method(name);
            console.log("[czimgui] hook: " + name + " on " + klass);
            break;
        } catch {}
    }

    if (!LateUpdateM) {
        console.log("[czimgui] WARNING: no hook found — using setInterval fallback");
        setInterval(() => { try { tick(); } catch(e) { console.log("[czimgui] tick err: " + e); } }, 16);
    } else {
        LateUpdateM.implementation = function(this: any) {
            try { tick(); } catch(e) { console.log("[czimgui] tick err: " + e); }
            return LateUpdateM.invokeRaw(this);   // invokeRaw avoids infinite recursion (NOT .invoke())
        };
    }

    // ── Hook: ModeSelectBtn.OnTriggerEnter (physical panel click) ────────────
    if (ModeSelectBtn) {
        try {
            const OnTrigEnter = ModeSelectBtn.method("OnTriggerEnter");
            OnTrigEnter.implementation = function(this: any, col: any) {
                try {
                    if (this.method("get_name").invoke().toString() === "@czimgui_panel" && menuOpen) {
                        handleClick(); _dirty = true;
                        return;   // swallow — don't forward to game
                    }
                } catch {}
                try { return OnTrigEnter.invokeRaw(this, col); } catch {}  // system error safety
            };
        } catch(e) { console.log("[czimgui] OnTriggerEnter hook err: " + e); }
    }

    console.log("[czimgui] ready — left secondary or left grip to toggle");
});
