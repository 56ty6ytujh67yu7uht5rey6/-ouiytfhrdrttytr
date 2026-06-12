using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text;
using System.Windows.Forms;

namespace IiBooLoader
{
    public class MainForm : Form
    {
        // ── Controls ──────────────────────────────────────────────────────────
        private ComboBox  _processCombo  = null!;
        private TextBox   _scriptPath    = null!;
        private Button    _browseBtn     = null!;
        private Button    _refreshBtn    = null!;
        private Button    _injectBtn     = null!;
        private Button    _stopBtn       = null!;
        private Label     _statusLbl     = null!;
        private RichTextBox _log         = null!;

        // ── State ─────────────────────────────────────────────────────────────
        private Process? _frida;

        // ── Palette ───────────────────────────────────────────────────────────
        static readonly Color C_BG      = Color.FromArgb(8,  8,  12);
        static readonly Color C_PANEL   = Color.FromArgb(14, 16, 24);
        static readonly Color C_ACCENT  = Color.FromArgb(42, 115, 230);
        static readonly Color C_TEXT    = Color.FromArgb(225, 230, 255);
        static readonly Color C_DIM     = Color.FromArgb(100, 110, 140);
        static readonly Color C_BTN     = Color.FromArgb(24,  30,  48);
        static readonly Color C_GREEN   = Color.FromArgb(50,  200, 80);
        static readonly Color C_RED     = Color.FromArgb(200, 50,  50);
        static readonly Color C_ORANGE  = Color.FromArgb(220, 150, 50);
        static readonly Color C_LOG_BG  = Color.FromArgb(5,   7,  10);
        static readonly Color C_LOG_FG  = Color.FromArgb(140, 215, 145);

        // ─────────────────────────────────────────────────────────────────────
        public MainForm()
        {
            BuildUI();
            RefreshProcesses();
        }

        // ── UI construction ───────────────────────────────────────────────────
        void BuildUI()
        {
            Text            = "ii boo loader";
            Size            = new Size(640, 520);
            MinimumSize     = new Size(640, 520);
            BackColor       = C_BG;
            ForeColor       = C_TEXT;
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox     = false;
            StartPosition   = FormStartPosition.CenterScreen;
            Font            = new Font("Segoe UI", 9f);

            // Title
            var title = new Label
            {
                Text      = "II BOO LOADER",
                Font      = new Font("Segoe UI", 20f, FontStyle.Bold),
                ForeColor = C_ACCENT,
                AutoSize  = true,
                Location  = new Point(18, 14),
            };

            var sub = new Label
            {
                Text      = "frida injector for Animal Company",
                ForeColor = C_DIM,
                AutoSize  = true,
                Location  = new Point(21, 46),
            };

            // ── Process row ──
            Lbl("Process", 18, 82);
            _processCombo = new ComboBox
            {
                Location      = new Point(100, 79),
                Width         = 380,
                BackColor     = C_PANEL,
                ForeColor     = C_TEXT,
                FlatStyle     = FlatStyle.Flat,
                DropDownStyle = ComboBoxStyle.DropDownList,
            };

            _refreshBtn = Btn("↻", 492, 77, 48, 26, C_BTN, C_DIM);
            _refreshBtn.Click += (_, __) => RefreshProcesses();

            // ── Script row ──
            Lbl("Script", 18, 120);
            _scriptPath = new TextBox
            {
                Location    = new Point(100, 117),
                Width       = 380,
                BackColor   = C_PANEL,
                ForeColor   = C_TEXT,
                BorderStyle = BorderStyle.FixedSingle,
                Text        = FindDefaultScript(),
            };

            _browseBtn = Btn("…", 492, 115, 48, 26, C_BTN, C_TEXT);
            _browseBtn.Click += OnBrowse;

            // ── Inject / Stop ──
            _injectBtn = Btn("INJECT", 18, 158, 140, 36, C_ACCENT, Color.White);
            _injectBtn.Font  = new Font("Segoe UI", 10f, FontStyle.Bold);
            _injectBtn.Click += OnInject;

            _stopBtn = Btn("STOP", 168, 158, 80, 36, C_RED, Color.White);
            _stopBtn.Font    = new Font("Segoe UI", 10f, FontStyle.Bold);
            _stopBtn.Enabled = false;
            _stopBtn.Click  += OnStop;

            _statusLbl = new Label
            {
                Text      = "idle",
                ForeColor = C_DIM,
                AutoSize  = true,
                Location  = new Point(262, 167),
            };

            // ── Log ──
            var logHdr  = Lbl("Output", 18, 210);
            var clearBtn = Btn("clear", 570, 207, 46, 20, C_BTN, C_DIM);
            clearBtn.Click += (_, __) => _log.Clear();

            _log = new RichTextBox
            {
                Location    = new Point(18, 232),
                Size        = new Size(598, 240),
                BackColor   = C_LOG_BG,
                ForeColor   = C_LOG_FG,
                Font        = new Font("Consolas", 8.5f),
                ReadOnly    = true,
                ScrollBars  = RichTextBoxScrollBars.Vertical,
                BorderStyle = BorderStyle.FixedSingle,
                WordWrap    = false,
            };

            Controls.AddRange(new Control[]
            {
                title, sub,
                _processCombo, _refreshBtn,
                _scriptPath,   _browseBtn,
                _injectBtn, _stopBtn, _statusLbl,
                logHdr, clearBtn, _log,
            });
        }

        // ── Helpers ───────────────────────────────────────────────────────────
        Label Lbl(string t, int x, int y)
        {
            var l = new Label { Text = t, ForeColor = C_DIM, AutoSize = true, Location = new Point(x, y) };
            Controls.Add(l);
            return l;
        }

        Button Btn(string t, int x, int y, int w, int h, Color bg, Color fg)
        {
            var b = new Button
            {
                Text      = t,
                Location  = new Point(x, y),
                Size      = new Size(w, h),
                BackColor = bg,
                ForeColor = fg,
                FlatStyle = FlatStyle.Flat,
                Cursor    = Cursors.Hand,
            };
            b.FlatAppearance.BorderColor         = Color.FromArgb(40, 50, 80);
            b.FlatAppearance.MouseOverBackColor   = ControlPaint.Light(bg, 0.15f);
            return b;
        }

        // ── Process list ─────────────────────────────────────────────────────
        void RefreshProcesses()
        {
            var prev = _processCombo.Text;
            _processCombo.Items.Clear();

            foreach (var p in Process.GetProcesses().OrderBy(p => p.ProcessName))
            {
                try { _processCombo.Items.Add($"{p.ProcessName} ({p.Id})"); }
                catch { /* process may have exited */ }
            }

            // Auto-select Animal Company
            string[] targets = { "AnimalCompany", "Animal Company", "Animal_Company" };
            foreach (var t in targets)
            {
                var hit = _processCombo.Items.Cast<string>()
                    .FirstOrDefault(s => s.StartsWith(t, StringComparison.OrdinalIgnoreCase));
                if (hit != null) { _processCombo.SelectedItem = hit; return; }
            }

            // Restore previous selection if it still exists
            if (prev != "" && _processCombo.Items.Contains(prev))
                _processCombo.Text = prev;
        }

        // ── Script auto-discover ──────────────────────────────────────────────
        string FindDefaultScript()
        {
            var dir = AppDomain.CurrentDomain.BaseDirectory;

            // Walk up to find the ii boo folder
            for (int i = 0; i < 5; i++)
            {
                foreach (var name in new[] { "iiboo.js", "imgui.js", "iiboo.ts", "imgui.ts" })
                {
                    var path = Path.Combine(dir, name);
                    if (File.Exists(path)) return path;
                }
                dir = Path.GetDirectoryName(dir) ?? dir;
            }
            return "";
        }

        // ── Browse ────────────────────────────────────────────────────────────
        void OnBrowse(object? s, EventArgs e)
        {
            using var dlg = new OpenFileDialog
            {
                Filter      = "Frida scripts (*.js;*.ts)|*.js;*.ts|All files (*.*)|*.*",
                Title       = "Select Frida script",
                FileName    = _scriptPath.Text,
            };
            if (dlg.ShowDialog() == DialogResult.OK)
                _scriptPath.Text = dlg.FileName;
        }

        // ── Inject ────────────────────────────────────────────────────────────
        void OnInject(object? s, EventArgs e)
        {
            if (_frida != null && !_frida.HasExited) { OnStop(s, e); return; }

            if (_processCombo.SelectedItem == null)
            { Log("Select a process first.", C_ORANGE); return; }

            if (!File.Exists(_scriptPath.Text))
            { Log("Script file not found: " + _scriptPath.Text, C_ORANGE); return; }

            // Parse PID: "ProcessName (1234)"
            var entry = _processCombo.SelectedItem.ToString()!;
            int pid   = int.Parse(entry[(entry.LastIndexOf('(') + 1)..].TrimEnd(')'));

            var frida = FindFrida();
            if (frida == null)
            {
                Log("frida.exe not found — install with:  pip install frida-tools", C_RED);
                return;
            }

            var script = _scriptPath.Text;
            var args   = $"-p {pid} -l \"{script}\" --no-pause";

            Log($"[loader] {frida} {args}", C_DIM);

            var psi = new ProcessStartInfo
            {
                FileName               = frida,
                Arguments              = args,
                UseShellExecute        = false,
                RedirectStandardOutput = true,
                RedirectStandardError  = true,
                CreateNoWindow         = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding  = Encoding.UTF8,
            };

            _frida = new Process { StartInfo = psi, EnableRaisingEvents = true };

            _frida.OutputDataReceived += (_, ev) =>
            { if (ev.Data != null) SafeLog(ev.Data, C_LOG_FG); };

            _frida.ErrorDataReceived += (_, ev) =>
            { if (ev.Data != null) SafeLog(ev.Data, C_ORANGE); };

            _frida.Exited += (_, __) =>
            {
                SafeLog("[loader] frida exited.", C_DIM);
                SafeSetStatus("stopped", C_DIM);
                Invoke(() =>
                {
                    _injectBtn.BackColor = C_ACCENT;
                    _injectBtn.Text      = "INJECT";
                    _stopBtn.Enabled     = false;
                });
            };

            _frida.Start();
            _frida.BeginOutputReadLine();
            _frida.BeginErrorReadLine();

            _injectBtn.BackColor = C_GREEN;
            _injectBtn.Text      = "RUNNING";
            _stopBtn.Enabled     = true;
            SetStatus($"injected → pid {pid}", C_GREEN);
            Log($"[loader] attached to pid {pid}  ·  {Path.GetFileName(script)}", C_ACCENT);
        }

        // ── Stop ─────────────────────────────────────────────────────────────
        void OnStop(object? s, EventArgs e)
        {
            try { _frida?.Kill(entireProcessTree: true); } catch { }
            _frida            = null;
            _injectBtn.BackColor = C_ACCENT;
            _injectBtn.Text      = "INJECT";
            _stopBtn.Enabled     = false;
            SetStatus("stopped", C_DIM);
            Log("[loader] stopped.", C_DIM);
        }

        // ── frida discovery ───────────────────────────────────────────────────
        static string? FindFrida()
        {
            // 1. On PATH
            if (TryFrida("frida")) return "frida";

            // 2. Common pip install locations
            var appdata  = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var roaming  = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            var userRoot = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);

            var candidates = new[]
            {
                Path.Combine(appdata,  @"Programs\Python\Python312\Scripts\frida.exe"),
                Path.Combine(appdata,  @"Programs\Python\Python311\Scripts\frida.exe"),
                Path.Combine(appdata,  @"Programs\Python\Python310\Scripts\frida.exe"),
                Path.Combine(roaming,  @"Python\Python312\Scripts\frida.exe"),
                Path.Combine(roaming,  @"Python\Python311\Scripts\frida.exe"),
                Path.Combine(userRoot, @"AppData\Local\Programs\Python\Python312\Scripts\frida.exe"),
                @"C:\Python312\Scripts\frida.exe",
                @"C:\Python311\Scripts\frida.exe",
            };

            foreach (var c in candidates)
                if (File.Exists(c)) return c;

            return null;
        }

        static bool TryFrida(string exe)
        {
            try
            {
                var p = Process.Start(new ProcessStartInfo(exe, "--version")
                    { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true });
                p?.WaitForExit(2000);
                return p?.ExitCode == 0;
            }
            catch { return false; }
        }

        // ── Logging ───────────────────────────────────────────────────────────
        void SafeLog(string msg, Color col)
        {
            if (InvokeRequired) Invoke(() => Log(msg, col));
            else Log(msg, col);
        }

        void SafeSetStatus(string msg, Color col)
        {
            if (InvokeRequired) Invoke(() => SetStatus(msg, col));
            else SetStatus(msg, col);
        }

        void Log(string msg, Color col)
        {
            _log.SelectionStart  = _log.TextLength;
            _log.SelectionLength = 0;
            _log.SelectionColor  = col;
            _log.AppendText(msg + "\n");
            _log.ScrollToCaret();
        }

        void SetStatus(string msg, Color col)
        {
            _statusLbl.Text      = msg;
            _statusLbl.ForeColor = col;
        }

        // ── Cleanup ───────────────────────────────────────────────────────────
        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            try { _frida?.Kill(entireProcessTree: true); } catch { }
            base.OnFormClosing(e);
        }

        // ── Entry point ───────────────────────────────────────────────────────
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }
}
