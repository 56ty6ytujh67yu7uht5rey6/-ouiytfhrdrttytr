# ii boo

Frida IL2CPP mods for **Animal Company** (VR).

## Files

| File | Description |
|---|---|
| `iiboo.ts` | Main mod — movement, gravity, body, hands, networking, spawn tools |
| `imgui.ts` | In-game VR panel with tab UI (Movement / Gravity / Body / Hands / Platforms) |
| `IiBooLoader/` | C# WinForms app to attach Frida to the game with one click |

## Requirements

- [Frida](https://frida.re) — `pip install frida-tools`
- [frida-il2cpp-bridge](https://github.com/vfsfitvnm/frida-il2cpp-bridge) — place `frida-il2cpp-bridge.js` next to the script
- Node.js + TypeScript (if compiling .ts → .js yourself)

## Usage

### Quick (loader GUI)
1. Build `IiBooLoader/` in Visual Studio (.NET 8)
2. Launch the game, then open `IiBooLoader.exe`
3. It auto-selects AnimalCompany — pick your script, hit **INJECT**

### Manual
```bash
frida -p <PID> -l iiboo.js --no-pause
```

## IiBooLoader

Dark-themed WinForms injector. Auto-discovers `frida.exe` from common Python install paths.  
Streams Frida stdout/stderr live into a colored log panel.

## License

Do whatever you want.
