// Ajudante de audio do Desk (Cenas e Controle). Compilado na primeira vez pelo csc do .NET 4 que
// vem no Windows (so C# 5), em userData/bin. Fala JSON por linha:
//
//   desk-audio.exe serve
//       le um pedido por linha no stdin ({"seq":1,"cmd":"state"}) e responde uma linha
//       ({"seq":1,"ok":true,"data":...}). Aparelho novo, padrao trocado ou propriedade mudada
//       (o "Escutar", por exemplo) viram {"event":"changed"}, sem seq.
//   desk-audio.exe state
//       o mesmo "state" do serve, uma vez (para conferir a mao).
//
// Comandos: state · setDefault {id} · setVolume {id, volume 0..1} · setMute {id, muted} ·
// setListen {id, enabled, target} · setAppVolume {app, volume} · setAppMute {app, muted} ·
// setDnd {on} · setDucking {on}
//
// O padrao e o "Escutar este dispositivo" usam o IPolicyConfig, a interface (nao documentada,
// mas estavel desde o Windows 7) que o proprio painel de Som usa. O Nao perturbe usa o
// IQuietHoursSettings, tambem interno: pode sumir numa atualizacao do Windows (dnd.available).
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;
using Microsoft.Win32;

[StructLayout(LayoutKind.Sequential)]
struct PropertyKey { public Guid fmtid; public int pid; }

[StructLayout(LayoutKind.Sequential)]
struct PropVariant { public ushort vt; public ushort r1, r2, r3; public IntPtr p; public IntPtr p2; }

[ComImport, Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IPropertyStore {
  [PreserveSig] int GetCount(out int count);
  [PreserveSig] int GetAt(int i, out PropertyKey key);
  [PreserveSig] int GetValue(ref PropertyKey key, out PropVariant value);
}

[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
  [PreserveSig] int Activate(ref Guid iid, int ctx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o);
  [PreserveSig] int OpenPropertyStore(int access, out IPropertyStore store);
  [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
}

[ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceCollection {
  [PreserveSig] int GetCount(out int count);
  [PreserveSig] int Item(int i, out IMMDevice device);
}

[ComImport, Guid("7991EEC9-7E89-4D85-8390-6C703CEC60C0"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMNotificationClient {
  void OnDeviceStateChanged([MarshalAs(UnmanagedType.LPWStr)] string id, int state);
  void OnDeviceAdded([MarshalAs(UnmanagedType.LPWStr)] string id);
  void OnDeviceRemoved([MarshalAs(UnmanagedType.LPWStr)] string id);
  void OnDefaultDeviceChanged(int flow, int role, [MarshalAs(UnmanagedType.LPWStr)] string id);
  void OnPropertyValueChanged([MarshalAs(UnmanagedType.LPWStr)] string id, PropertyKey key);
}

[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
  [PreserveSig] int EnumAudioEndpoints(int flow, int stateMask, out IMMDeviceCollection devices);
  [PreserveSig] int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice device);
  [PreserveSig] int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
  [PreserveSig] int RegisterEndpointNotificationCallback(IMMNotificationClient client);
  [PreserveSig] int UnregisterEndpointNotificationCallback(IMMNotificationClient client);
}

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
class MMDeviceEnumerator { }

[ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  [PreserveSig] int RegisterControlChangeNotify(IntPtr p);
  [PreserveSig] int UnregisterControlChangeNotify(IntPtr p);
  [PreserveSig] int GetChannelCount(out int count);
  [PreserveSig] int SetMasterVolumeLevel(float level, ref Guid context);
  [PreserveSig] int SetMasterVolumeLevelScalar(float level, ref Guid context);
  [PreserveSig] int GetMasterVolumeLevel(out float level);
  [PreserveSig] int GetMasterVolumeLevelScalar(out float level);
  [PreserveSig] int SetChannelVolumeLevel(int channel, float level, ref Guid context);
  [PreserveSig] int SetChannelVolumeLevelScalar(int channel, float level, ref Guid context);
  [PreserveSig] int GetChannelVolumeLevel(int channel, out float level);
  [PreserveSig] int GetChannelVolumeLevelScalar(int channel, out float level);
  [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid context);
  [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
}

[ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionManager2 {
  [PreserveSig] int GetAudioSessionControl(IntPtr a, int b, IntPtr c);
  [PreserveSig] int GetSimpleAudioVolume(IntPtr a, int b, IntPtr c);
  [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator sessions);
}

[ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionEnumerator {
  [PreserveSig] int GetCount(out int count);
  [PreserveSig] int GetSession(int i, out IAudioSessionControl2 session);
}

[ComImport, Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionControl2 {
  [PreserveSig] int GetState(out int state);
  [PreserveSig] int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string name);
  [PreserveSig] int SetDisplayName(IntPtr a, IntPtr b);
  [PreserveSig] int GetIconPath(IntPtr a);
  [PreserveSig] int SetIconPath(IntPtr a, IntPtr b);
  [PreserveSig] int GetGroupingParam(IntPtr a);
  [PreserveSig] int SetGroupingParam(IntPtr a, IntPtr b);
  [PreserveSig] int RegisterAudioSessionNotification(IntPtr a);
  [PreserveSig] int UnregisterAudioSessionNotification(IntPtr a);
  [PreserveSig] int GetSessionIdentifier(IntPtr a);
  [PreserveSig] int GetSessionInstanceIdentifier(IntPtr a);
  [PreserveSig] int GetProcessId(out uint pid);
  [PreserveSig] int IsSystemSoundsSession();
}

[ComImport, Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface ISimpleAudioVolume {
  [PreserveSig] int SetMasterVolume(float level, ref Guid context);
  [PreserveSig] int GetMasterVolume(out float level);
  [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid context);
  [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
}

// Só a ordem dos métodos importa (vtable); os que não usamos ficam com assinatura qualquer
[ComImport, Guid("f8679f50-850a-41cf-9c72-430f290290c8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IPolicyConfig {
  [PreserveSig] int GetMixFormat(IntPtr a, IntPtr b);
  [PreserveSig] int GetDeviceFormat(IntPtr a, int b, IntPtr c);
  [PreserveSig] int ResetDeviceFormat(IntPtr a);
  [PreserveSig] int SetDeviceFormat(IntPtr a, IntPtr b, IntPtr c);
  [PreserveSig] int GetProcessingPeriod(IntPtr a, int b, IntPtr c, IntPtr d);
  [PreserveSig] int SetProcessingPeriod(IntPtr a, IntPtr b);
  [PreserveSig] int GetShareMode(IntPtr a, IntPtr b);
  [PreserveSig] int SetShareMode(IntPtr a, IntPtr b);
  [PreserveSig] int GetPropertyValue(IntPtr a, int b, IntPtr c, IntPtr d);
  [PreserveSig] int SetPropertyValue([MarshalAs(UnmanagedType.LPWStr)] string id, int fxStore, ref PropertyKey key, ref PropVariant value);
  [PreserveSig] int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string id, int role);
}

[ComImport, Guid("870af99c-171d-4f9e-af0d-e63df40c2bc9")]
class PolicyConfigClient { }

[ComImport, Guid("6bff4732-81ec-4ffb-ae67-b6c1bc29631f"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IQuietHoursSettings {
  [PreserveSig] int GetUserSelectedProfile([MarshalAs(UnmanagedType.LPWStr)] out string profile);
  [PreserveSig] int SetUserSelectedProfile([MarshalAs(UnmanagedType.LPWStr)] string profile);
}

[ComImport, Guid("f53321fa-34f8-4b7f-b9a3-361877cb94cf")]
class QuietHoursSettings { }

class Notifier : IMMNotificationClient {
  public void OnDeviceStateChanged(string id, int state) { DeskAudio.Event(); }
  public void OnDeviceAdded(string id) { DeskAudio.Event(); }
  public void OnDeviceRemoved(string id) { DeskAudio.Event(); }
  public void OnDefaultDeviceChanged(int flow, int role, string id) { DeskAudio.Event(); }
  public void OnPropertyValueChanged(string id, PropertyKey key) {
    // Só o que a tela mostra: o "Escutar" (e o destino dele) e o nome do aparelho
    if (key.fmtid == DeskAudio.ListenKey.fmtid || key.fmtid == DeskAudio.FriendlyName.fmtid) DeskAudio.Event();
  }
}

static class DeskAudio {
  const int RENDER = 0, CAPTURE = 1, ACTIVE = 1, CLSCTX_ALL = 23;
  const int CONSOLE = 0, MULTIMEDIA = 1, COMMUNICATIONS = 2;
  const string DND_ON = "Microsoft.QuietHoursProfile.PriorityOnly";
  const string DND_OFF = "Microsoft.QuietHoursProfile.Unrestricted";
  const string DUCKING_KEY = @"Software\Microsoft\Multimedia\Audio";

  public static readonly PropertyKey FriendlyName = new PropertyKey { fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"), pid = 14 };
  // Nome do driver ("VB-Audio Virtual Cable"): continua igual quando você renomeia o aparelho
  static readonly PropertyKey InterfaceName = new PropertyKey { fmtid = new Guid("026e516e-b814-414b-83cd-856d6fef4822"), pid = 2 };
  // "Escutar este dispositivo": pid 1 liga (VT_BOOL), pid 0 é a saída que toca (id; vazio = padrão)
  public static readonly PropertyKey ListenKey = new PropertyKey { fmtid = new Guid("24dbb0fc-9311-4b3d-9cf0-18ff155639d4"), pid = 1 };
  static readonly PropertyKey ListenTargetKey = new PropertyKey { fmtid = new Guid("24dbb0fc-9311-4b3d-9cf0-18ff155639d4"), pid = 0 };

  static readonly object OutLock = new object();
  static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
  static bool serving;

  [DllImport("ole32.dll")] static extern int PropVariantClear(ref PropVariant pv);

  [MTAThread]
  static int Main(string[] args) {
    Console.OutputEncoding = new System.Text.UTF8Encoding(false);
    Console.InputEncoding = new System.Text.UTF8Encoding(false);
    Json.MaxJsonLength = 16 * 1024 * 1024;
    try {
      if (args.Length == 1 && args[0] == "state") { Console.WriteLine(Json.Serialize(State())); return 0; }
      if (args.Length == 1 && args[0] == "serve") { Serve(); return 0; }
      Console.Error.WriteLine("uso: desk-audio.exe serve | state");
      return 2;
    } catch (Exception e) {
      Console.Error.WriteLine(e.Message);
      return 1;
    }
  }

  static void Serve() {
    serving = true;
    var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumerator();
    var notifier = new Notifier();
    enumerator.RegisterEndpointNotificationCallback(notifier);
    Write(new Dictionary<string, object> { { "event", "ready" } });
    string line;
    while ((line = Console.In.ReadLine()) != null) {
      if (line.Trim() == "") continue;
      object seq = null;
      var reply = new Dictionary<string, object>();
      try {
        var req = Json.Deserialize<Dictionary<string, object>>(line);
        req.TryGetValue("seq", out seq);
        reply["data"] = Handle(Str(req, "cmd"), req);
        reply["ok"] = true;
      } catch (Exception e) {
        reply["ok"] = false;
        reply["error"] = e.Message;
      }
      reply["seq"] = seq;
      Write(reply);
    }
    enumerator.UnregisterEndpointNotificationCallback(notifier);
    GC.KeepAlive(notifier);
  }

  public static void Event() {
    if (serving) Write(new Dictionary<string, object> { { "event", "changed" } });
  }

  static void Write(object value) {
    lock (OutLock) {
      Console.Out.WriteLine(Json.Serialize(value));
      Console.Out.Flush();
    }
  }

  static object Handle(string cmd, Dictionary<string, object> req) {
    switch (cmd) {
      case "state": return State();
      case "setDefault": SetDefault(Str(req, "id")); return null;
      case "setVolume": EndpointVolume(Str(req, "id")).SetMasterVolumeLevelScalar(Unit(req, "volume"), ref Ctx); return null;
      case "setMute": Check(EndpointVolume(Str(req, "id")).SetMute(Bool(req, "muted"), ref Ctx), "mutar"); return null;
      case "setListen": SetListen(Str(req, "id"), Bool(req, "enabled"), Str(req, "target")); return null;
      case "setAppVolume": ForApp(Str(req, "app"), v => v.SetMasterVolume(Unit(req, "volume"), ref Ctx)); return null;
      case "setAppMute": ForApp(Str(req, "app"), v => v.SetMute(Bool(req, "muted"), ref Ctx)); return null;
      case "setDnd": SetDnd(Bool(req, "on")); return null;
      case "setDucking": SetDucking(Bool(req, "on")); return null;
    }
    throw new Exception("comando desconhecido: " + cmd);
  }

  static Guid Ctx = Guid.Empty;

  // ---------- leitura ----------
  static Dictionary<string, object> State() {
    var en = (IMMDeviceEnumerator)new MMDeviceEnumerator();
    var outputs = new List<object>();
    var inputs = new List<object>();
    string defOut = DefaultOf(en, RENDER, CONSOLE), defOutComm = DefaultOf(en, RENDER, COMMUNICATIONS);
    string defIn = DefaultOf(en, CAPTURE, CONSOLE), defInComm = DefaultOf(en, CAPTURE, COMMUNICATIONS);
    foreach (var d in Devices(en, RENDER)) outputs.Add(Describe(d, defOut, defOutComm, false));
    foreach (var d in Devices(en, CAPTURE)) inputs.Add(Describe(d, defIn, defInComm, true));
    return new Dictionary<string, object> {
      { "outputs", outputs },
      { "inputs", inputs },
      { "apps", Apps(en) },
      { "dnd", Dnd() },
      { "ducking", Ducking() },
    };
  }

  static List<IMMDevice> Devices(IMMDeviceEnumerator en, int flow) {
    var list = new List<IMMDevice>();
    IMMDeviceCollection col;
    if (en.EnumAudioEndpoints(flow, ACTIVE, out col) != 0) return list;
    int n;
    col.GetCount(out n);
    for (int i = 0; i < n; i++) {
      IMMDevice d;
      if (col.Item(i, out d) == 0) list.Add(d);
    }
    return list;
  }

  static Dictionary<string, object> Describe(IMMDevice d, string def, string defComm, bool capture) {
    string id;
    d.GetId(out id);
    IPropertyStore store;
    d.OpenPropertyStore(0, out store);
    var item = new Dictionary<string, object> {
      { "id", id },
      { "name", StrProp(store, FriendlyName) },
      { "driver", StrProp(store, InterfaceName) },
      { "isDefault", id == def },
      { "isDefaultComm", id == defComm },
      { "volume", 0.0 },
      { "muted", false },
    };
    try {
      var vol = Volume(d);
      float level;
      bool muted;
      if (vol.GetMasterVolumeLevelScalar(out level) == 0) item["volume"] = Math.Round(level, 3);
      if (vol.GetMute(out muted) == 0) item["muted"] = muted;
    } catch { }
    if (capture && store != null) {
      PropVariant v;
      bool listen = false;
      var key = ListenKey;
      if (store.GetValue(ref key, out v) == 0) {
        listen = v.vt == 11 && (v.p.ToInt64() & 0xffff) != 0;
        PropVariantClear(ref v);
      }
      item["listen"] = listen;
      item["listenTarget"] = StrProp(store, ListenTargetKey);
    }
    return item;
  }

  static string StrProp(IPropertyStore store, PropertyKey key) {
    if (store == null) return "";
    PropVariant v;
    if (store.GetValue(ref key, out v) != 0) return "";
    string s = v.vt == 31 ? Marshal.PtrToStringUni(v.p) : "";
    PropVariantClear(ref v);
    return s ?? "";
  }

  static string DefaultOf(IMMDeviceEnumerator en, int flow, int role) {
    IMMDevice d;
    if (en.GetDefaultAudioEndpoint(flow, role, out d) != 0) return null;
    string id;
    d.GetId(out id);
    return id;
  }

  static IAudioEndpointVolume Volume(IMMDevice d) {
    var iid = typeof(IAudioEndpointVolume).GUID;
    object o;
    Check(d.Activate(ref iid, CLSCTX_ALL, IntPtr.Zero, out o), "abrir o volume");
    return (IAudioEndpointVolume)o;
  }

  static IAudioEndpointVolume EndpointVolume(string id) {
    var en = (IMMDeviceEnumerator)new MMDeviceEnumerator();
    IMMDevice d;
    Check(en.GetDevice(id, out d), "achar o aparelho");
    return Volume(d);
  }

  // ---------- apps ----------
  class AppInfo { public string Key; public string Name; public float Volume = 1; public bool Muted; public bool Active; }

  // Uma linha por programa (o Edge abre várias sessões, em processos diferentes), somando
  // as saídas: o volume de app vale em qualquer saída em que ele toque
  static List<object> Apps(IMMDeviceEnumerator en) {
    var byKey = new Dictionary<string, AppInfo>();
    var order = new List<string>();
    var names = new Dictionary<uint, string[]>();
    foreach (var d in Devices(en, RENDER)) {
      foreach (var s in Sessions(d)) {
        if (s.IsSystemSoundsSession() == 0) continue;
        int state;
        s.GetState(out state);
        if (state == 2) continue; // expirada
        uint pid;
        if (s.GetProcessId(out pid) != 0 || pid == 0) continue;
        string[] proc;
        if (!names.TryGetValue(pid, out proc)) names[pid] = proc = ProcessNames(pid);
        if (proc == null) continue;
        AppInfo app;
        if (!byKey.TryGetValue(proc[0], out app)) {
          app = new AppInfo { Key = proc[0], Name = proc[1] };
          byKey[proc[0]] = app;
          order.Add(proc[0]);
        }
        var sv = (ISimpleAudioVolume)s;
        float level;
        bool muted;
        if (sv.GetMasterVolume(out level) == 0) app.Volume = level;
        if (sv.GetMute(out muted) == 0) app.Muted = muted;
        if (state == 1) app.Active = true;
      }
    }
    var list = new List<object>();
    foreach (var key in order) {
      var a = byKey[key];
      list.Add(new Dictionary<string, object> {
        { "key", a.Key }, { "name", a.Name }, { "volume", Math.Round(a.Volume, 3) }, { "muted", a.Muted }, { "active", a.Active },
      });
    }
    return list;
  }

  static List<IAudioSessionControl2> Sessions(IMMDevice d) {
    var list = new List<IAudioSessionControl2>();
    var iid = typeof(IAudioSessionManager2).GUID;
    object o;
    if (d.Activate(ref iid, CLSCTX_ALL, IntPtr.Zero, out o) != 0) return list;
    IAudioSessionEnumerator sessions;
    if (((IAudioSessionManager2)o).GetSessionEnumerator(out sessions) != 0) return list;
    int n;
    sessions.GetCount(out n);
    for (int i = 0; i < n; i++) {
      IAudioSessionControl2 s;
      if (sessions.GetSession(i, out s) == 0) list.Add(s);
    }
    return list;
  }

  // [chave, nome bonito]: chave = nome do processo em minúsculas ("msedge"), nome = a descrição
  // do executável ("Microsoft Edge") quando dá para ler
  static string[] ProcessNames(uint pid) {
    try {
      var p = Process.GetProcessById((int)pid);
      string key = p.ProcessName.ToLowerInvariant();
      string name = p.ProcessName;
      try {
        var desc = p.MainModule.FileVersionInfo.FileDescription;
        if (!string.IsNullOrEmpty(desc)) name = desc.Trim();
      } catch { }
      return new[] { key, name };
    } catch { return null; }
  }

  static void ForApp(string key, Func<ISimpleAudioVolume, int> apply) {
    if (string.IsNullOrEmpty(key)) throw new Exception("app vazio");
    var en = (IMMDeviceEnumerator)new MMDeviceEnumerator();
    var names = new Dictionary<uint, string[]>();
    int done = 0;
    foreach (var d in Devices(en, RENDER)) {
      foreach (var s in Sessions(d)) {
        if (s.IsSystemSoundsSession() == 0) continue;
        uint pid;
        if (s.GetProcessId(out pid) != 0 || pid == 0) continue;
        string[] proc;
        if (!names.TryGetValue(pid, out proc)) names[pid] = proc = ProcessNames(pid);
        if (proc == null || proc[0] != key) continue;
        if (apply((ISimpleAudioVolume)s) == 0) done++;
      }
    }
    if (done == 0) throw new Exception("o app não está tocando nada agora");
  }

  // ---------- escrita ----------
  static void SetDefault(string id) {
    var pc = (IPolicyConfig)new PolicyConfigClient();
    foreach (int role in new[] { CONSOLE, MULTIMEDIA, COMMUNICATIONS }) Check(pc.SetDefaultEndpoint(id, role), "trocar o padrão");
  }

  static void SetListen(string id, bool enabled, string target) {
    var pc = (IPolicyConfig)new PolicyConfigClient();
    if (enabled && !string.IsNullOrEmpty(target)) {
      var tk = ListenTargetKey;
      var tv = new PropVariant { vt = 31, p = Marshal.StringToCoTaskMemUni(target) };
      try { Check(pc.SetPropertyValue(id, 0, ref tk, ref tv), "escolher a saída do Escutar"); }
      finally { Marshal.FreeCoTaskMem(tv.p); }
    }
    var lk = ListenKey;
    var lv = new PropVariant { vt = 11, p = new IntPtr(enabled ? 0xffff : 0) };
    Check(pc.SetPropertyValue(id, 0, ref lk, ref lv), "ligar o Escutar");
  }

  static Dictionary<string, object> Dnd() {
    try {
      var q = (IQuietHoursSettings)new QuietHoursSettings();
      string profile;
      if (q.GetUserSelectedProfile(out profile) != 0) throw new Exception();
      return new Dictionary<string, object> { { "available", true }, { "on", profile != DND_OFF }, { "profile", profile } };
    } catch {
      return new Dictionary<string, object> { { "available", false }, { "on", false }, { "profile", "" } };
    }
  }

  static void SetDnd(bool on) {
    var q = (IQuietHoursSettings)new QuietHoursSettings();
    Check(q.SetUserSelectedProfile(on ? DND_ON : DND_OFF), "mudar o Não perturbe");
  }

  // Aba Comunicações do painel de Som: 0 muta os outros sons, 1 abaixa 80% (padrão do
  // Windows), 2 abaixa 50%, 3 não faz nada
  static bool Ducking() {
    using (var key = Registry.CurrentUser.OpenSubKey(DUCKING_KEY)) {
      var value = key == null ? null : key.GetValue("UserDuckingPreference");
      return !(value is int) || (int)value != 3;
    }
  }

  static void SetDucking(bool on) {
    using (var key = Registry.CurrentUser.CreateSubKey(DUCKING_KEY)) {
      key.SetValue("UserDuckingPreference", on ? 1 : 3, RegistryValueKind.DWord);
    }
  }

  // ---------- ajudantes ----------
  static void Check(int hr, string what) {
    if (hr != 0) throw new Exception("o Windows recusou " + what + " (0x" + hr.ToString("x8") + ")");
  }

  static string Str(Dictionary<string, object> req, string key) {
    object v;
    return req.TryGetValue(key, out v) && v != null ? v.ToString() : "";
  }

  static bool Bool(Dictionary<string, object> req, string key) {
    object v;
    return req.TryGetValue(key, out v) && v is bool && (bool)v;
  }

  static float Unit(Dictionary<string, object> req, string key) {
    object v;
    if (!req.TryGetValue(key, out v) || v == null) throw new Exception(key + " vazio");
    double d = Convert.ToDouble(v, System.Globalization.CultureInfo.InvariantCulture);
    if (double.IsNaN(d)) throw new Exception(key + " inválido");
    return (float)Math.Min(1, Math.Max(0, d));
  }
}
