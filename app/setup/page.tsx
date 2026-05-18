"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Wifi,
  Smartphone,
  Usb,
  Loader2,
  RefreshCw,
  CheckCircle,
  ChevronLeft,
  AlertTriangle,
  MapPin,
  Cpu,
  Zap,
  Maximize2,
  Terminal as TerminalIcon,
  X
} from 'lucide-react';

// Real flashing dependencies (dynamic import to avoid SSR issues if any, but "use client" handles it)
import { ESPLoader, Transport } from 'esptool-js';

// ==========================================
// MOCK NODE.JS BACKEND CALLS (PLACEHOLDERS)
// ==========================================
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const backendAPI = {
  saveDeviceConfig: async (name: string) => {
    console.log(`NODEJS: Saving device name '${name}' to database/device...`);
    return new Promise(resolve => setTimeout(resolve, 1000));
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveRepeaterConfig: async (config: any) => {
    console.log(`NODEJS: Saving repeater config to database:`, config);
    return new Promise(resolve => setTimeout(resolve, 1500));
  }
};

// ==========================================
// WIZARD UI COMPONENT
// ==========================================

export default function SetupWizard() {
  type SerialCommandSpec = {
    command: string;
    fallbackCommands?: string[];
    timeoutMs?: number;
    retries?: number;
    allowTimeout?: boolean;
    requireReply?: boolean;
    expectedResponseParts?: string[];
  };

  type SerialCommandResult = {
    lines: string[];
    timedOut: boolean;
  };

  const [step, setStep] = useState('intro');
  const [deviceName, setDeviceName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [flashProgress, setFlashProgress] = useState(0);
  const [settingsProgress, setSettingsProgress] = useState({ current: 0, total: 0, label: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapZoom, setMapZoom] = useState(5);
  const [mapCenter, setMapCenter] = useState({ lat: 30.3, lon: -91.2 });
  const [isMapDragging, setIsMapDragging] = useState(false);

  // Serial API state (UI only)
  type SerialSupport = 'checking' | 'supported' | 'insecure' | 'unsupported';
  const [serialSupport, setSerialSupport] = useState<SerialSupport>('checking');
  const [serialStatus, setSerialStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');

  // Hardware Refs (for actual logic)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const portRef = useRef<any>(null);
  const transportRef = useRef<Transport | null>(null);
  const esploaderRef = useRef<ESPLoader | null>(null);

  // Terminal state
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const terminalLogsRef = useRef<string[]>([]);
  const pendingTerminalLogsRef = useRef<string[]>([]);
  const terminalFlushScheduledRef = useRef<boolean>(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const keepReading = useRef<boolean>(true);
  const backgroundReaderRunningRef = useRef<boolean>(false);
  const mapDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startCenter: { lat: number; lon: number };
    moved: boolean;
  } | null>(null);
  const mapWheelRef = useRef({ delta: 0, lastZoomAt: 0 });

  // Repeater specific state
  const [repeaterConfig, setRepeaterConfig] = useState({
    name: '',
    locationSet: false,
    locX: 50,
    locY: 50,
    lat: 36.5,
    lon: -95.5,
    height: '',
    email: '',
    password: ''
  });

  // Check for Web Serial compatibility on mount
  useEffect(() => {
    if ('serial' in navigator) {
      setSerialSupport('supported');
    } else if (!window.isSecureContext) {
      setSerialSupport('insecure');
    } else {
      setSerialSupport('unsupported');
    }
  }, []);

  useEffect(() => {
    if (!isMapDragging) return;

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
    };
  }, [isMapDragging]);

  // Update real logs state from ref
  const addLog = (msg: string) => {
    pendingTerminalLogsRef.current.push(msg);
    if (terminalFlushScheduledRef.current) return;

    terminalFlushScheduledRef.current = true;
    window.setTimeout(() => {
      terminalFlushScheduledRef.current = false;
      const pendingLogs = pendingTerminalLogsRef.current.splice(0);
      if (pendingLogs.length === 0) return;

      terminalLogsRef.current = [...terminalLogsRef.current, ...pendingLogs].slice(-200);
      setTerminalLogs([...terminalLogsRef.current]);
    }, 50);
  };

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  const waitForReaderRelease = async () => {
    let waitCount = 0;
    while (readerRef.current !== null && waitCount < 40) {
      await sleep(50);
      waitCount++;
    }
    await sleep(100);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const waitForReadableUnlock = async (selectedPort: any, timeoutMs = 2500) => {
    const startedAt = Date.now();

    while (selectedPort?.readable?.locked) {
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error("Serial stream is still locked by another reader.");
      }
      await sleep(50);
    }
  };

  const stopBackgroundReader = async () => {
    keepReading.current = false;

    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
      } catch (e) {
        console.error("Reader cancel error:", e);
      }
    }

    await waitForReaderRelease();
  };

  // Scroll to bottom of terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [terminalLogs]);

  // Web Serial Connection Logic
  const handleConnectSerial = async () => {
    if (!('serial' in navigator)) return;

    setSerialStatus('connecting');
    try {
      // @ts-expect-error -- typescript might not have navigator.serial
      const selectedPort = await navigator.serial.requestPort();

      // Guard: If the port is already open (e.g. from a previous successful connection), 
      // check readable/writable before attempting to open it again.
      if (!selectedPort.readable) {
        await selectedPort.open({ baudRate: 115200 });
      }

      portRef.current = selectedPort;
      setSerialStatus('connected');

      // Initialize transport for ESPTool
      const transport = new Transport(selectedPort);
      transportRef.current = transport;

      addLog("[SYSTEM] Port connected successfully.\n");
      startReading(selectedPort);
    } catch (err) {
      console.error('Serial connection failed:', err);
      setSerialStatus('error');
      addLog(`[ERROR] Connection failed: ${err}\n`);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const startReading = async (selectedPort: any) => {
    if (backgroundReaderRunningRef.current) return;

    backgroundReaderRunningRef.current = true;
    keepReading.current = true;
    try {
      while (selectedPort.readable && keepReading.current) {
        if (selectedPort.readable.locked) {
          await sleep(50);
          continue;
        }

        const reader = selectedPort.readable.getReader();
        readerRef.current = reader;
        try {
          while (keepReading.current) {
            const { value, done } = await reader.read();
            if (done) break;
            const decoded = new TextDecoder().decode(value);
            addLog(decoded);
          }
        } catch (err) {
          console.error("Serial read error:", err);
          break;
        } finally {
          reader.releaseLock();
          readerRef.current = null;
        }
      }
    } finally {
      backgroundReaderRunningRef.current = false;
    }
  };

  const handleSendTestPacket = async () => {
    const port = portRef.current;
    if (!port || !port.writable) return;

    const writer = port.writable.getWriter();
    const data = new TextEncoder().encode("LMESH_TEST_PACKET\n");

    try {
      await writer.write(data);
      addLog("[DEBUG] Sent test packet: LMESH_TEST_PACKET\n");
    } catch (err) {
      console.error("Failed to send data:", err);
      addLog(`[ERROR] Send failed: ${err}\n`);
    } finally {
      writer.releaseLock();
    }
  };

  const handleDebugBypassFlash = (type: 'client' | 'repeater') => {
    if (isProcessing) return;

    setErrorMsg('');
    setFlashProgress(100);
    addLog(`[DEBUG] Flash bypass enabled for ${type}. Skipping firmware write.\n`);
    goTo(type === 'client' ? 'client_restart' : 'repeater_restart');
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const writeSerialLine = async (selectedPort: any, line: string) => {
    if (!selectedPort?.writable) throw new Error("Serial port is not writable.");

    const writer = selectedPort.writable.getWriter();
    try {
      const data = new TextEncoder().encode(`${line}\r\n`);
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wakeSerialCli = async (selectedPort: any) => {
    addLog("[CMD] Waking MeshCore serial CLI...\n");
    await writeSerialLine(selectedPort, "ver");
    await readSerialResponse(selectedPort, 1500);
    await sleep(500);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const readSerialResponse = async (selectedPort: any, timeoutMs = 2200): Promise<SerialCommandResult> => {
    if (!selectedPort?.readable) throw new Error("Serial port is not readable.");

    await waitForReadableUnlock(selectedPort);
    const reader = selectedPort.readable.getReader();
    readerRef.current = reader;

    let timedOut = false;
    let buffer = '';
    const lines: string[] = [];

    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      reader.cancel().catch(() => { });
    }, timeoutMs);

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;

        const decoded = new TextDecoder().decode(value);
        addLog(decoded);
        buffer += decoded;

        let newlineIdx = buffer.indexOf('\n');
        while (newlineIdx !== -1) {
          const line = buffer.slice(0, newlineIdx).replace(/\r/g, '').trim();
          if (line.length > 0) lines.push(line);
          buffer = buffer.slice(newlineIdx + 1);
          newlineIdx = buffer.indexOf('\n');
        }
      }
    } catch (err) {
      if (!timedOut) {
        throw err;
      }
    } finally {
      clearTimeout(timeoutId);
      reader.releaseLock();
      readerRef.current = null;
      const danglingLine = buffer.replace(/\r/g, '').trim();
      if (danglingLine.length > 0) lines.push(danglingLine);
    }

    return { lines, timedOut };
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runSerialCommand = async (selectedPort: any, spec: SerialCommandSpec) => {
    const retries = spec.retries ?? 3;
    const timeoutMs = spec.timeoutMs ?? 2200;
    const requireReply = spec.requireReply ?? !spec.allowTimeout;
    const commandVariants = [spec.command, ...(spec.fallbackCommands ?? [])];
    let lastError: unknown = null;

    const getCurrentCommandResponse = (lines: string[], command: string) => {
      const echoIndex = lines.map((line) => line.trim()).lastIndexOf(command);
      return echoIndex >= 0 ? lines.slice(echoIndex) : lines;
    };

    for (const command of commandVariants) {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          addLog(`[CMD] > ${command}\n`);
          await writeSerialLine(selectedPort, command);

          const response = await readSerialResponse(selectedPort, timeoutMs);
          const combinedResponse = response.lines.join(' | ');
          const relevantLines = getCurrentCommandResponse(response.lines, command);
          const relevantResponse = relevantLines.join(' | ');
          if (combinedResponse.length > 0) {
            addLog(`[CMD] < ${combinedResponse}\n`);
          }

          if (!requireReply && response.lines.length === 0) {
            lastError = new Error(`No reply received for "${command}"`);
            if (attempt < retries) {
              addLog(`[CMD] No reply; resending ${command} (${attempt + 1}/${retries})...\n`);
              await sleep(300);
              continue;
            }
            break;
          }

          if (requireReply && response.lines.length === 0) {
            throw new Error(`No reply received for "${command}"`);
          }

          const expectedResponseMatched = spec.expectedResponseParts?.every((part) => relevantResponse.includes(part)) ?? false;
          if (spec.expectedResponseParts) {
            if (expectedResponseMatched) {
              return;
            }

            throw new Error(`Unexpected response for "${command}": ${relevantResponse || combinedResponse}`);
          }

          if (/error|failed|invalid|unknown command/i.test(relevantResponse)) {
            throw new Error(`Device returned error for "${command}": ${relevantResponse}`);
          }

          if (/\bOK\b/i.test(relevantResponse)) {
            return;
          }

          if (response.timedOut && !spec.allowTimeout) {
            throw new Error(`Timed out waiting for response to "${command}"`);
          }

          return;
        } catch (err) {
          lastError = err;
          if (attempt < retries) {
            addLog(`[CMD] No valid reply; resending ${command} (${attempt + 1}/${retries})...\n`);
            await sleep(300);
          }
        }
      }

      if (commandVariants.length > 1) {
        addLog(`[CMD] Trying alternate command syntax after ${command} did not work.\n`);
      }
    }

    if (spec.allowTimeout && !requireReply) {
      addLog(`[CMD] Continuing after no reply from ${spec.command}; next command will verify state.\n`);
      return;
    }

    if (lastError) {
      throw lastError;
    }
  };

  const buildRepeaterSerialCommands = (): SerialCommandSpec[] => {
    const commands: SerialCommandSpec[] = [];

    const repeaterName = repeaterConfig.name.trim();
    if (repeaterName) {
      commands.push({ command: `set name ${repeaterName}`, timeoutMs: 3000, retries: 3, allowTimeout: true, requireReply: false });
      commands.push({ command: "get name", timeoutMs: 3000, retries: 3, expectedResponseParts: [repeaterName] });
    }

    const adminPassword = repeaterConfig.password.trim();
    if (adminPassword) {
      commands.push({ command: `password ${adminPassword}`, timeoutMs: 3000, retries: 3, allowTimeout: true, requireReply: false });
    }

    if (repeaterConfig.locationSet) {
      commands.push({ command: `set lat ${repeaterConfig.lat.toFixed(6)}`, timeoutMs: 3000, retries: 3, allowTimeout: true, requireReply: false });
      commands.push({ command: `set lon ${repeaterConfig.lon.toFixed(6)}`, timeoutMs: 3000, retries: 3, allowTimeout: true, requireReply: false });
    }

    commands.push({ command: "reboot", timeoutMs: 1500, retries: 2, allowTimeout: true, requireReply: false });
    return commands;
  };

  const getRepeaterCommandLabel = (command: string) => {
    if (command === "reboot") return "Rebooting repeater";
    if (command.startsWith("set name")) return "Setting node name";
    if (command === "get name") return "Verifying node name";
    if (command.startsWith("password")) return "Setting admin password";
    if (command.startsWith("set lat")) return "Setting latitude";
    if (command.startsWith("set lon")) return "Setting longitude";
    return "Sending repeater setting";
  };

  const applyRepeaterRadioProfile = async (selectedPort: unknown) => {
    const verifyRadioCommand: SerialCommandSpec = {
      command: "get radio",
      timeoutMs: 3000,
      retries: 3,
      expectedResponseParts: ["910.525", "62.5", "9", "7"]
    };

    try {
      await runSerialCommand(selectedPort, {
        command: "set radio 910.525,62.5,9,7",
        timeoutMs: 3000,
        retries: 3,
        allowTimeout: true,
        requireReply: false
      });
      await runSerialCommand(selectedPort, verifyRadioCommand);
    } catch (err) {
      addLog(`[CMD] Comma radio syntax did not verify: ${(err as Error).message}\n`);
      addLog("[CMD] Trying space-separated radio syntax...\n");
      await runSerialCommand(selectedPort, {
        command: "set radio 910.525 62.5 9 7",
        timeoutMs: 3000,
        retries: 3,
        allowTimeout: true,
        requireReply: false
      });
      await runSerialCommand(selectedPort, verifyRadioCommand);
    }
  };

  const handleApplyRepeaterConfig = async () => {
    if (isProcessing) return;

    const selectedPort = portRef.current;
    if (!selectedPort || !selectedPort.readable || !selectedPort.writable) {
      setErrorMsg("Reconnect the repeater over serial before joining the mesh.");
      goTo('repeater_error');
      return;
    }

    setErrorMsg('');
    setIsProcessing(true);
    let configApplied = false;

    try {
      await stopBackgroundReader();
      const commands = buildRepeaterSerialCommands();
      const totalSettingsSteps = 2 + commands.length;
      let completedSettingsSteps = 0;

      const updateProgress = (label: string) => {
        setSettingsProgress({ current: completedSettingsSteps, total: totalSettingsSteps, label });
      };

      const completeProgressStep = (label: string) => {
        completedSettingsSteps++;
        setSettingsProgress({ current: completedSettingsSteps, total: totalSettingsSteps, label });
      };

      updateProgress("Waking MeshCore CLI");
      await wakeSerialCli(selectedPort);
      completeProgressStep("MeshCore CLI ready");
      addLog("\n[CONFIG] Applying repeater serial settings...\n");
      addLog("[CONFIG] US profile -> 910.525MHz / 62.5kHz / SF9 / CR7\n");

      updateProgress("Applying radio profile");
      await applyRepeaterRadioProfile(selectedPort);
      completeProgressStep("Radio profile verified");

      for (const command of commands) {
        const label = getRepeaterCommandLabel(command.command);
        updateProgress(label);
        await runSerialCommand(selectedPort, command);
        completeProgressStep(label);
      }

      addLog("[CONFIG] Repeater settings applied successfully.\n");
      configApplied = true;
      setSerialStatus('disconnected');
      portRef.current = null;
      goTo('repeater_ready');
    } catch (err: unknown) {
      console.error("Repeater serial config error:", err);
      const msg = (err as Error).message || String(err);
      setErrorMsg(msg);
      setSettingsProgress((progress) => ({ ...progress, label: "Settings failed" }));
      addLog(`[ERROR] Repeater config failed: ${msg}\n`);
      goTo('repeater_error');
    } finally {
      setIsProcessing(false);
      if (!configApplied && portRef.current?.readable) {
        startReading(portRef.current);
      }
    }
  };

  // Real Flashing Logic for ESP32
  const handleFlashReal = async () => {
    if (isProcessing || !portRef.current || !transportRef.current) {
      return;
    }

    const type = step.startsWith('client') ? 'client' : 'repeater';
    goTo(type === 'client' ? 'client_flashing' : 'repeater_flashing');
    setIsProcessing(true);
    setFlashProgress(0);

    // Stop our background terminal reader so esptool can take over
    await stopBackgroundReader();

    // Crucial: Close the port if it's open so esptool can take over
    const activePort = portRef.current;
    if (activePort) {
      try {
        await activePort.close();
      } catch (e) {
        console.error("Error closing port before flash:", e);
      }
    }

    const binPath = `/firmware/${selectedDevice}/${type}/firmware.bin`;

    try {
      // 1. Fetch the binary
      addLog(`[FLASH] Fetching firmware: ${binPath}\n`);
      const response = await fetch(binPath);
      if (!response.ok) throw new Error(`Firmware not found at ${binPath}. Ensure it exists in public/firmware/...`);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const firmwareData = new Uint8Array(arrayBuffer);
      addLog(`[FLASH] Binary loaded (${firmwareData.length} bytes)\n`);

      // 2. Prepare ESP Loader
      addLog("\n--- BOOTLOADER HANDSHAKE STARTS ---\n");

      const espLoaderTerminal = {
        clean: () => {
          // terminalLogsRef.current = [];
          // setTerminalLogs([]);
        },
        writeLine: (data: string) => addLog(data + "\n"),
        write: (data: string) => addLog(data)
      };

      const esploader = new ESPLoader({
        transport: transportRef.current!,
        baudrate: 115200,
        terminal: espLoaderTerminal,
        romBaudrate: 115200
      });
      esploaderRef.current = esploader;

      // 3. Connect to Bootloader
      await esploader.main();
      addLog(`[FLASH] Connected to chip: ${esploader.chip.CHIP_NAME}\n`);

      // 4. Write Flash
      // esptool-js (some versions) expects binary string instead of Uint8Array for file data
      const imageBstr = esploader.ui8ToBstr(firmwareData);

      const flashOptions = {
        fileArray: [{ data: imageBstr, address: 0x0 }],
        flashSize: 'keep',
        flashMode: 'keep',
        flashFreq: 'keep',
        eraseAll: false,
        calculateMD5Hash: () => "",
        reportProgress: (fileIndex: number, written: number, total: number) => {
          const progress = (written / total) * 100;
          setFlashProgress(progress);
        },
        compress: true
      };

      addLog("[FLASH] Erasing and writing flash...\n");
      await esploader.writeFlash(flashOptions);

      addLog("\n--- FLASHING SUCCESSFUL ---\n");

      setIsProcessing(false);

      // Delay slightly before moving to restart page so they can see "SUCCESS"
      setTimeout(() => {
        setSerialStatus('disconnected');
        portRef.current = null;
        goTo(type === 'client' ? 'client_restart' : 'repeater_restart');
      }, 1500);

    } catch (err: unknown) {
      console.error("Flashing error:", err);
      const msg = (err as Error).message || String(err);
      addLog(`\n[FATAL ERROR] ${msg}\n`);
      setErrorMsg(msg);
      setIsProcessing(false);

      // Navigate to error state
      setTimeout(() => {
        setSerialStatus('disconnected');
        portRef.current = null;
        goTo(type === 'client' ? 'client_error' : 'repeater_error');
      }, 100);
    } finally {
      // Release the port from esptool so it can be re-opened for terminal reading
      if (transportRef.current) {
        try {
          await transportRef.current.disconnect();
        } catch { }
      }
    }
  };

  // Helper to change steps
  const goTo = (nextStep: string) => setStep(nextStep);

  const getProgress = () => {
    const steps: Record<string, number> = {
      intro: 0,
      client_explain: 10, client_select_device: 20, client_connect: 35, client_flashing: 50, client_error: 50, client_restart: 70, client_name: 85, client_ready: 100,
      repeater_explain: 10, repeater_select_device: 20, repeater_connect: 35, repeater_flashing: 50, repeater_error: 50, repeater_restart: 70, repeater_config: 85, repeater_ready: 100
    };
    return steps[step] || 0;
  };

  const availableDevices = [
    { id: 'heltec-v3', name: 'Heltec V3', supported: true },
    { id: 'heltec-v4', name: 'Heltec V4', supported: true },
    { id: 't-1000e', name: 'T-1000E', supported: false },
    { id: 'seeed-p1', name: 'SeeedStudio P1', supported: false }
  ];

  // ==========================================
  // SHARED UI COMPONENTS
  // ==========================================

  const serialAvailable = serialSupport === 'supported';

  const renderCompatibilityWarning = () => {
    if (serialSupport === 'checking') return null;

    if (serialSupport === 'insecure') {
      return (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start animate-in fade-in slide-in-from-top-2 text-left">
          <AlertTriangle className="text-amber-600 mt-0.5 mr-3 flex-shrink-0" size={20} />
          <div>
            <h3 className="font-semibold text-amber-900 text-sm">Secure Connection Required</h3>
            <p className="text-amber-800 text-xs mt-1">
              Web Serial only works over HTTPS or on this computer via{' '}
              <span className="font-mono">localhost</span>. Open{' '}
              <span className="font-mono">http://localhost:3000/setup</span> on the machine
              with the USB cable, or use your site&apos;s HTTPS URL.
            </p>
          </div>
        </div>
      );
    }

    if (serialSupport === 'unsupported') {
      return (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start animate-in fade-in slide-in-from-top-2 text-left">
          <AlertTriangle className="text-red-500 mt-0.5 mr-3 flex-shrink-0" size={20} />
          <div>
            <h3 className="font-semibold text-red-900 text-sm">Browser Not Compatible</h3>
            <p className="text-red-700 text-xs mt-1">
              Your browser does not expose the Web Serial API. Use Chrome, Edge, or Brave in a
              normal browser window (not an embedded preview or in-app browser).
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderTerminal = () => (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-all ${showTerminal ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="w-full max-w-3xl bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[65vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-2 text-gray-300">
            <TerminalIcon size={18} />
            <span className="font-mono text-sm font-semibold">ESP32 Flash Terminal</span>
          </div>
          <button onClick={() => setShowTerminal(false)} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 font-mono text-xs leading-relaxed text-emerald-400 bg-black scrollbar-thin scrollbar-thumb-gray-800">
          {terminalLogs.map((log, i) => (
            <span key={i} className="whitespace-pre-wrap">{log}</span>
          ))}
          <div ref={terminalEndRef} />
        </div>
        <div className="px-6 py-3 bg-gray-900 border-t border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest">Device: {selectedDevice || 'None'}</span>
            {isProcessing && (
              <span className="text-[10px] text-blue-400 uppercase tracking-widest animate-pulse">Flashing in progress...</span>
            )}
          </div>
          <button
            onClick={() => { terminalLogsRef.current = []; setTerminalLogs([]); }}
            className="text-xs text-gray-500 hover:text-white underline"
          >
            Clear Logs
          </button>
        </div>
      </div>
    </div>
  );

  // ==========================================
  // FLOW RENDERING (ABRIDGED FOR READABILITY)
  // ==========================================

  const renderIntro = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Welcome to the Gulf Coast Mesh Wizard</h1>
        <p className="text-gray-500 max-w-md mx-auto">
          Choose the type of node you want to set up today.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-4 mt-8">
        <button onClick={() => goTo('client_explain')} className="group p-6 bg-white border-2 border-gray-200 rounded-2xl hover:border-blue-500 transition-all text-left">
          <Smartphone size={28} className="text-blue-600 mb-4" />
          <h3 className="text-xl font-semibold mb-1">Setup a Client</h3>
          <p className="text-gray-500 text-sm">Personal gateway node.</p>
        </button>
        <button onClick={() => goTo('repeater_explain')} className="group p-6 bg-white border-2 border-gray-200 rounded-2xl hover:border-indigo-500 transition-all text-left">
          <Wifi size={28} className="text-indigo-600 mb-4" />
          <h3 className="text-xl font-semibold mb-1">Setup a Repeater</h3>
          <p className="text-gray-500 text-sm">Network Repeater node.</p>
        </button>
      </div>
    </div>
  );

  const renderClientExplain = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
      <button onClick={() => goTo('intro')} className="text-xs text-gray-400 flex items-center"><ChevronLeft size={14} /> Back</button>
      <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
        <h2 className="text-2xl font-bold mb-3">Meshcore Clients</h2>
        <p className="text-gray-600 text-sm mb-4">The client firmware enables your hardware to root packets through the decentralized LMESH network.</p>
      </div>
      <div className="flex justify-end"><button onClick={() => goTo('client_select_device')} className="px-6 py-3 bg-blue-600 text-white rounded-xl">Next: Select Device</button></div>
    </div>
  );

  const renderClientSelectDevice = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
      <button onClick={() => goTo('client_explain')} className="text-xs text-gray-400 flex items-center"><ChevronLeft size={14} /> Back</button>
      <div className="grid grid-cols-2 gap-4">
        {availableDevices.map((d) => (
          <button key={d.id} onClick={() => d.supported && setSelectedDevice(d.id)} className={`p-6 rounded-xl border-2 transition-all relative ${!d.supported ? 'opacity-40 cursor-not-allowed' : selectedDevice === d.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'}`}>
            {!d.supported && <span className="absolute top-2 right-2 text-[10px] bg-gray-200 px-1 rounded">SOON</span>}
            <Cpu size={24} className="mb-2 mx-auto" strokeWidth={1.5} />
            <span className="block text-center font-bold text-sm tracking-tight">{d.name}</span>
          </button>
        ))}
      </div>
      <div className="flex justify-end"><button onClick={() => goTo('client_connect')} disabled={!selectedDevice} className="px-8 py-3 bg-blue-600 disabled:bg-gray-200 text-white rounded-xl">Next: Connect</button></div>
    </div>
  );

  const renderClientConnect = () => (
    <div className="space-y-8 text-center py-4">
      <button onClick={() => goTo('client_select_device')} className="absolute top-12 left-12 text-xs text-gray-400 flex items-center"><ChevronLeft size={14} /> Back</button>
      <Usb size={48} className="mx-auto text-gray-400 mb-4" />
      <h2 className="text-2xl font-bold">Connect your {selectedDevice}</h2>
      <p className="text-gray-500 text-sm max-w-xs mx-auto">Plug in via USB and click below to unlock the serial port.</p>
      {renderCompatibilityWarning()}
      <div className="flex flex-col items-center gap-4">
        {serialStatus !== 'connected' ? (
          <button
            onClick={handleConnectSerial}
            disabled={!serialAvailable}
            className="px-10 py-4 bg-blue-600 disabled:bg-gray-300 disabled:shadow-none text-white rounded-2xl font-bold shadow-lg shadow-blue-200 flex items-center gap-2"
          >
            {serialStatus === 'connecting' ? <Loader2 className="animate-spin" /> : <Usb size={20} />}
            SELECT SERIAL PORT
          </button>
        ) : (
          <div className="space-y-6 w-full">
            <div className="bg-green-50 text-green-700 px-4 py-2 rounded-full text-xs font-bold border border-green-200 inline-flex items-center gap-2">
              <CheckCircle size={14} /> READY TO FLASH
            </div>
            <div className="flex justify-center gap-4">
              <button disabled={isProcessing} onClick={handleSendTestPacket} className="p-3 bg-amber-100 text-amber-700 rounded-xl hover:bg-amber-200 transition-colors disabled:opacity-50"><Zap size={20} /></button>
              <button disabled={isProcessing} onClick={handleFlashReal} className="px-12 py-4 bg-gray-900 text-white rounded-2xl font-bold tracking-widest hover:scale-[1.02] transition-transform disabled:bg-gray-400">
                {isProcessing ? "INITIALIZING..." : "START FLASHING"}
              </button>
            </div>
            <button
              disabled={isProcessing}
              onClick={() => handleDebugBypassFlash('client')}
              className="mx-auto block text-xs text-blue-700 font-bold underline disabled:opacity-40"
            >
              DEBUG: SKIP FLASH
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderClientFlashing = () => (
    <div className="space-y-8 text-center py-10">
      <div className="relative mx-auto w-32 h-32">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-100" />
          <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="364.4" strokeDashoffset={364.4 - (364.4 * flashProgress) / 100} className="text-blue-600 transition-all duration-300" strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-gray-900">{Math.round(flashProgress)}%</span>
        </div>
      </div>
      <div>
        <h2 className="text-2xl font-bold mb-1">Writing Firmware</h2>
        <p className="text-gray-400 text-sm">Injecting Meshcore Client to ESP32...</p>
      </div>
      <button onClick={() => setShowTerminal(true)} className="flex items-center gap-2 mx-auto text-xs text-blue-600 font-bold bg-blue-50 px-4 py-2 rounded-lg"><TerminalIcon size={14} /> SHOW LIVE TERMINAL</button>
    </div>
  );

  const renderClientError = () => (
    <div className="space-y-8 text-center py-10 animate-in fade-in zoom-in duration-300">
      <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto"><AlertTriangle size={40} /></div>
      <div>
        <h2 className="text-2xl font-bold text-red-900">Flashing Failed</h2>
        <p className="text-gray-500 text-sm mt-2 max-w-xs mx-auto">
          {errorMsg || "An unexpected error occurred during the transfer."}
        </p>
      </div>
      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <button onClick={() => goTo('client_connect')} className="px-10 py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2">
          <RefreshCw size={18} /> TRY AGAIN
        </button>
        <button onClick={() => setShowTerminal(true)} className="text-xs text-blue-600 font-bold">VIEW DETAILED LOGS</button>
      </div>
    </div>
  );

  const renderClientRestart = () => (
    <div className="space-y-8 text-center py-10">
      <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto"><CheckCircle size={40} /></div>
      <h2 className="text-2xl font-bold">Flashing Successful!</h2>
      <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 text-left max-w-sm mx-auto">
        <p className="text-xs text-blue-500 uppercase font-black mb-2">Bluetooth Ready</p>
        <p className="text-sm text-blue-900 leading-relaxed">
          Your device is now running Bluetooth firmware. Download and install the MeshCore app,
          then connect to this device over Bluetooth.
        </p>
      </div>
      <button onClick={() => { setStep('intro'); setSerialStatus('disconnected'); portRef.current = null; }} className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200">SETUP ANOTHER NODE</button>
    </div>
  );

  const renderClientName = () => (
    <div className="space-y-6 max-w-xs mx-auto">
      <h2 className="text-2xl font-bold text-center">Name your node</h2>
      <input type="text" value={deviceName} onChange={e => setDeviceName(e.target.value)} placeholder="e.g. Ghost-1" className="w-full p-4 rounded-xl border-2 border-gray-100 focus:border-blue-600 outline-none transition-colors" />
      <button onClick={() => goTo('client_ready')} disabled={!deviceName} className="w-full py-4 bg-gray-900 disabled:bg-gray-200 text-white rounded-xl font-bold">FINISH SETUP</button>
    </div>
  );

  const renderClientReady = () => (
    <div className="text-center py-10 space-y-6">
      <div className="w-24 h-24 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-green-200"><CheckCircle size={48} /></div>
      <h2 className="text-3xl font-black">All Systems Go.</h2>
      <p className="text-gray-500">Your client <span className="text-gray-900 font-bold">{deviceName}</span> is now part of the mesh.</p>
      <button onClick={() => { setStep('intro'); setSerialStatus('disconnected'); portRef.current = null; }} className="text-blue-600 font-bold pt-10">SETUP ANOTHER NODE</button>
    </div>
  );

  // REPEATER FLOW (SAME LOGIC, DIFFERENT COLORS)
  const renderRepeaterExplain = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
      <button onClick={() => goTo('intro')} className="text-xs text-gray-400 flex items-center"><ChevronLeft size={14} /> Back</button>
      <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
        <h2 className="text-2xl font-bold mb-3">Meshcore Repeaters</h2>
        <p className="text-gray-600 text-sm mb-4">Repeater nodes that skip packets across the state. Higher placement equals better range.</p>
      </div>
      <div className="flex justify-end"><button onClick={() => goTo('repeater_select_device')} className="px-6 py-3 bg-indigo-600 text-white rounded-xl">Next: Select Device</button></div>
    </div>
  );

  const renderRepeaterSelectDevice = () => (
    <div className="space-y-6">
      <button onClick={() => goTo('repeater_explain')} className="text-xs text-gray-400 flex items-center"><ChevronLeft size={14} /> Back</button>
      <div className="grid grid-cols-2 gap-4">
        {availableDevices.map((d) => (
          <button key={d.id} onClick={() => d.supported && setSelectedDevice(d.id)} className={`p-6 rounded-xl border-2 transition-all relative ${!d.supported ? 'opacity-40 cursor-not-allowed' : selectedDevice === d.id ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
            {!d.supported && <span className="absolute top-2 right-2 text-[10px] bg-gray-200 px-1 rounded">SOON</span>}
            <Cpu size={24} className="mb-2 mx-auto" strokeWidth={1.5} />
            <span className="block text-center font-bold text-sm tracking-tight">{d.name}</span>
          </button>
        ))}
      </div>
      <div className="flex justify-end"><button onClick={() => goTo('repeater_connect')} disabled={!selectedDevice} className="px-8 py-3 bg-indigo-600 disabled:bg-gray-200 text-white rounded-xl">Next: Connect</button></div>
    </div>
  );

  const renderRepeaterConnect = () => (
    <div className="space-y-8 text-center py-4">
      <button onClick={() => goTo('repeater_select_device')} className="absolute top-12 left-12 text-xs text-gray-400 flex items-center"><ChevronLeft size={14} /> Back</button>
      <Usb size={48} className="mx-auto text-gray-400 mb-4" />
      <h2 className="text-2xl font-bold">Connect Repeater</h2>
      {renderCompatibilityWarning()}
      {serialStatus !== 'connected' ? (
        <button
          onClick={handleConnectSerial}
          disabled={!serialAvailable}
          className="px-10 py-4 bg-indigo-600 disabled:bg-gray-300 disabled:shadow-none text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 flex items-center gap-2 mx-auto"
        >
          {serialStatus === 'connecting' ? <Loader2 className="animate-spin" /> : <Usb size={20} />}
          SELECT SERIAL PORT
        </button>
      ) : (
        <div className="space-y-6 w-full">
          <div className="bg-green-50 text-green-700 px-4 py-2 rounded-full text-xs font-bold border border-green-200 inline-flex items-center gap-2">
            <CheckCircle size={14} /> LINK STABLE
          </div>
          <div className="flex justify-center gap-4">
            <button disabled={isProcessing} onClick={handleSendTestPacket} className="p-3 bg-amber-100 text-amber-700 rounded-xl hover:bg-amber-200 transition-colors disabled:opacity-50"><Zap size={20} /></button>
            <button disabled={isProcessing} onClick={handleFlashReal} className="px-12 py-4 bg-gray-900 text-white rounded-2xl font-bold tracking-widest disabled:bg-gray-400">
              {isProcessing ? "PREPARING..." : "START FLASHING"}
            </button>
          </div>
          <button
            disabled={isProcessing}
            onClick={() => handleDebugBypassFlash('repeater')}
            className="mx-auto block text-xs text-indigo-700 font-bold underline disabled:opacity-40"
          >
            DEBUG: SKIP FLASH
          </button>
        </div>
      )}
    </div>
  );

  const renderRepeaterFlashing = () => (
    <div className="space-y-8 text-center py-10">
      <div className="relative mx-auto w-32 h-32">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-100" />
          <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="364.4" strokeDashoffset={364.4 - (364.4 * flashProgress) / 100} className="text-indigo-600 transition-all duration-300" strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-black text-gray-900">{Math.round(flashProgress)}%</span>
        </div>
      </div>
      <div>
        <h2 className="text-2xl font-bold mb-1">Writing Repeater Firmware</h2>
        <p className="text-gray-400 text-sm">Streaming packets to ESP32...</p>
      </div>
      <button onClick={() => setShowTerminal(true)} className="flex items-center gap-2 mx-auto text-xs text-indigo-600 font-bold bg-indigo-50 px-4 py-2 rounded-lg"><TerminalIcon size={14} /> SHOW LIVE TERMINAL</button>
    </div>
  );

  // ... (Other repeater steps omitted for brevity, logic follows client structure but with repeater theme/config)
  const renderRepeaterRestart = () => (
    <div className="space-y-8 text-center py-10">
      <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto animate-in zoom-in duration-500"><CheckCircle size={40} /></div>
      <h2 className="text-2xl font-bold">Repeater Ready</h2>
      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 text-left max-w-sm mx-auto">
        <p className="text-xs text-gray-400 uppercase font-black mb-2">Hard Reset Required</p>
        <ul className="text-sm text-gray-600 space-y-2">
          <li className="flex gap-2"><span>1.</span> Unplug USB cable</li>
          <li className="flex gap-2"><span>2.</span> Wait 2 seconds</li>
          <li className="flex gap-2"><span>3.</span> Re-insert USB cable</li>
        </ul>
      </div>
      <div className="flex flex-col items-center gap-4">
        {serialStatus !== 'connected' ? (
          <button
            onClick={handleConnectSerial}
            disabled={!serialAvailable}
            className="px-10 py-4 bg-indigo-600 disabled:bg-gray-300 disabled:shadow-none text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 flex items-center gap-2"
          >
            <RefreshCw size={20} className={serialStatus === 'connecting' ? 'animate-spin' : ''} />
            RECONNECT DEVICE
          </button>
        ) : (
          <button onClick={() => goTo('repeater_config')} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold animate-in fade-in scale-in-95 duration-300">CONFIGURE LOCATION</button>
        )}
      </div>
    </div>
  );

  const tileSize = 256;
  const clampMapZoom = (zoom: number) => Math.min(15, Math.max(3, zoom));
  const clampMapLat = (lat: number) => Math.min(85, Math.max(-85, lat));

  const lonLatToPixel = (lat: number, lon: number, zoom: number) => {
    const worldSize = tileSize * 2 ** zoom;
    const clampedLat = clampMapLat(lat);
    const sinLat = Math.sin((clampedLat * Math.PI) / 180);

    return {
      x: ((lon + 180) / 360) * worldSize,
      y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * worldSize
    };
  };

  const pixelToLonLat = (x: number, y: number, zoom: number) => {
    const worldSize = tileSize * 2 ** zoom;
    const lon = (x / worldSize) * 360 - 180;
    const mercatorY = 0.5 - y / worldSize;
    const lat = 90 - (360 * Math.atan(Math.exp(-mercatorY * 2 * Math.PI))) / Math.PI;

    return { lat: clampMapLat(lat), lon };
  };

  const getMapTiles = (expanded: boolean) => {
    const centerPixel = lonLatToPixel(mapCenter.lat, mapCenter.lon, mapZoom);
    const centerTileX = Math.floor(centerPixel.x / tileSize);
    const centerTileY = Math.floor(centerPixel.y / tileSize);
    const tileRange = expanded ? 5 : 3;
    const tileCount = 2 ** mapZoom;
    const tiles: { key: string; url: string; left: number; top: number }[] = [];

    for (let xOffset = -tileRange; xOffset <= tileRange; xOffset++) {
      for (let yOffset = -tileRange; yOffset <= tileRange; yOffset++) {
        const tileX = centerTileX + xOffset;
        const tileY = centerTileY + yOffset;
        if (tileY < 0 || tileY >= tileCount) continue;

        const wrappedTileX = ((tileX % tileCount) + tileCount) % tileCount;
        tiles.push({
          key: `${mapZoom}-${tileX}-${tileY}`,
          url: `https://tile.openstreetmap.org/${mapZoom}/${wrappedTileX}/${tileY}.png`,
          left: tileX * tileSize - centerPixel.x,
          top: tileY * tileSize - centerPixel.y
        });
      }
    }

    return tiles;
  };

  const setRepeaterLocationFromPoint = (clientX: number, clientY: number, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const centerPixel = lonLatToPixel(mapCenter.lat, mapCenter.lon, mapZoom);
    const clickedPixelX = centerPixel.x + clientX - (rect.left + rect.width / 2);
    const clickedPixelY = centerPixel.y + clientY - (rect.top + rect.height / 2);
    const { lat, lon } = pixelToLonLat(clickedPixelX, clickedPixelY, mapZoom);

    setRepeaterConfig({ ...repeaterConfig, locationSet: true, locX: 50, locY: 50, lat, lon });
  };

  const handleMapPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    mapDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startCenter: mapCenter,
      moved: false
    };
  };

  const handleMapPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const dragState = mapDragRef.current;
    if (!dragState || dragState.pointerId !== e.pointerId) return;

    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    if (!dragState.moved && Math.hypot(dx, dy) < 5) return;

    dragState.moved = true;
    setIsMapDragging(true);

    const startCenterPixel = lonLatToPixel(dragState.startCenter.lat, dragState.startCenter.lon, mapZoom);
    const nextCenter = pixelToLonLat(startCenterPixel.x - dx, startCenterPixel.y - dy, mapZoom);
    setMapCenter(nextCenter);
  };

  const handleMapPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const dragState = mapDragRef.current;
    if (!dragState || dragState.pointerId !== e.pointerId) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch { }

    mapDragRef.current = null;
    setIsMapDragging(false);

    if (!dragState.moved) {
      setRepeaterLocationFromPoint(e.clientX, e.clientY, e.currentTarget);
    }
  };

  const handleMapPointerCancel = () => {
    mapDragRef.current = null;
    setIsMapDragging(false);
  };

  const handleMapWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const now = Date.now();
    mapWheelRef.current.delta += e.deltaY;

    // Slow wheel/trackpad zoom down so a normal scroll gesture only changes one level.
    if (Math.abs(mapWheelRef.current.delta) < 260 || now - mapWheelRef.current.lastZoomAt < 220) {
      return;
    }

    const direction = mapWheelRef.current.delta < 0 ? 1 : -1;
    mapWheelRef.current = { delta: 0, lastZoomAt: now };
    setMapZoom((zoom) => clampMapZoom(zoom + direction));
  };

  const handleMapKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    setRepeaterConfig({ ...repeaterConfig, locationSet: true, locX: 50, locY: 50, lat: mapCenter.lat, lon: mapCenter.lon });
  };

  const handleCoordinateChange = (field: 'lat' | 'lon', value: string) => {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) return;

    const nextLat = field === 'lat' ? clampMapLat(numericValue) : repeaterConfig.lat;
    const nextLon = field === 'lon' ? numericValue : repeaterConfig.lon;
    setMapCenter({ lat: nextLat, lon: nextLon });
    setRepeaterConfig({ ...repeaterConfig, locationSet: true, lat: nextLat, lon: nextLon, locX: 50, locY: 50 });
  };

  const renderRepeaterLocationMap = (expanded = false) => {
    const centerPixel = lonLatToPixel(mapCenter.lat, mapCenter.lon, mapZoom);
    const pinPixel = lonLatToPixel(repeaterConfig.lat, repeaterConfig.lon, mapZoom);
    const pinLeft = pinPixel.x - centerPixel.x;
    const pinTop = pinPixel.y - centerPixel.y;

    return (
      <div
        onPointerDown={handleMapPointerDown}
        onPointerMove={handleMapPointerMove}
        onPointerUp={handleMapPointerUp}
        onPointerCancel={handleMapPointerCancel}
        onWheelCapture={handleMapWheel}
        onWheel={handleMapWheel}
        onKeyDown={handleMapKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Select repeater location on real map"
        className={`${expanded ? 'h-[70vh]' : 'h-56'} w-full bg-slate-200 relative rounded-xl border-2 border-emerald-200 overflow-hidden ${isMapDragging ? 'cursor-grabbing' : 'cursor-grab'} touch-none select-none overscroll-contain focus:outline-none focus:ring-2 focus:ring-indigo-500`}
        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        {getMapTiles(expanded).map((tile) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={tile.key}
            alt=""
            draggable={false}
            src={tile.url}
            className="pointer-events-none absolute h-64 w-64 select-none"
            style={{ left: `calc(50% + ${tile.left}px)`, top: `calc(50% + ${tile.top}px)` }}
          />
        ))}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-black/10" />
        <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold text-slate-700 shadow-sm">
          OpenStreetMap
        </div>
        {!expanded && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              if (repeaterConfig.locationSet) setMapCenter({ lat: repeaterConfig.lat, lon: repeaterConfig.lon });
              setShowMapModal(true);
            }}
          className="absolute right-3 top-3 rounded-full bg-white/95 p-2 text-indigo-700 shadow-sm hover:bg-white"
            aria-label="Maximize map"
          >
            <Maximize2 size={15} />
          </button>
        )}
        <div className="absolute right-3 top-14 flex flex-col overflow-hidden rounded-xl bg-white/95 shadow-sm">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setMapZoom((zoom) => clampMapZoom(zoom + 1))}
            className="px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-100"
          >
            +
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setMapZoom((zoom) => clampMapZoom(zoom - 1))}
            className="border-t px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-100"
          >
            -
          </button>
        </div>
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold text-slate-600 shadow-sm">
          Drag to pan, scroll or +/- to zoom, click to place
        </div>
        {repeaterConfig.locationSet && (
          <MapPin
            size={expanded ? 38 : 30}
            className="pointer-events-none text-indigo-700 absolute z-10 drop-shadow-md"
            style={{ left: `calc(50% + ${pinLeft}px)`, top: `calc(50% + ${pinTop}px)`, transform: 'translate(-50%, -100%)' }}
          />
        )}
        {!repeaterConfig.locationSet && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] font-bold text-slate-700">CLICK MAP TO PIN REPEATER LOCATION</div>}
      </div>
    );
  };

  const renderRepeaterConfig = () => (
    <div className="space-y-4 max-w-sm mx-auto overflow-y-auto px-2 max-h-[70vh]">
      <h2 className="text-xl font-bold text-center">Node Config</h2>
      <input type="text" value={repeaterConfig.name} onChange={e => setRepeaterConfig({ ...repeaterConfig, name: e.target.value })} placeholder="Node Name" className="w-full p-3 rounded-lg border" />
      {renderRepeaterLocationMap()}
      {repeaterConfig.locationSet && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Latitude
            <input
              type="number"
              step="0.000001"
              value={repeaterConfig.lat.toFixed(6)}
              onChange={(e) => handleCoordinateChange('lat', e.target.value)}
              className="mt-1 w-full rounded-lg border p-2 text-sm font-normal text-gray-900"
            />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Longitude
            <input
              type="number"
              step="0.000001"
              value={repeaterConfig.lon.toFixed(6)}
              onChange={(e) => handleCoordinateChange('lon', e.target.value)}
              className="mt-1 w-full rounded-lg border p-2 text-sm font-normal text-gray-900"
            />
          </label>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <input type="number" value={repeaterConfig.height} onChange={e => setRepeaterConfig({ ...repeaterConfig, height: e.target.value })} placeholder="Height (ft)" className="w-full p-3 rounded-lg border text-sm" />
        <input type="email" value={repeaterConfig.email} onChange={e => setRepeaterConfig({ ...repeaterConfig, email: e.target.value })} placeholder="Contact Email" className="w-full p-3 rounded-lg border text-sm" />
      </div>
      <input type="password" value={repeaterConfig.password} onChange={e => setRepeaterConfig({ ...repeaterConfig, password: e.target.value })} placeholder="Admin Password" className="w-full p-3 rounded-lg border" />
      <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-[11px] text-indigo-700">
        Repeater radio profile will be set over serial to US defaults with SF9 / CR7.
      </div>
      {isProcessing && settingsProgress.total > 0 && (
        <div className="rounded-xl border border-indigo-100 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between text-[11px] font-bold text-indigo-700">
            <span>{settingsProgress.label || "Sending settings"}</span>
            <span>{Math.round((settingsProgress.current / settingsProgress.total) * 100)}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-indigo-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${(settingsProgress.current / settingsProgress.total) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] text-gray-500">
            Step {settingsProgress.current} of {settingsProgress.total}
          </p>
        </div>
      )}
      {serialStatus !== 'connected' && (
        <p className="text-[11px] text-amber-600">Reconnect serial on the previous step before joining mesh.</p>
      )}
      <button
        onClick={handleApplyRepeaterConfig}
        disabled={isProcessing || serialStatus !== 'connected'}
        className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold mt-2 disabled:bg-gray-300"
      >
        {isProcessing ? "APPLYING SERIAL SETTINGS..." : "JOIN MESH"}
      </button>
      <button onClick={() => setShowTerminal(true)} className="w-full py-2 text-xs text-indigo-700 font-bold">OPEN SERIAL LOGS</button>
    </div>
  );

  const renderRepeaterReady = () => (
    <div className="text-center py-10 space-y-6">
      <div className="w-24 h-24 bg-indigo-600 text-white rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-indigo-100"><Wifi size={48} /></div>
      <h2 className="text-3xl font-black">Node Streaming.</h2>
      <p className="text-gray-500">Repeater node <span className="text-gray-900 font-bold">{repeaterConfig.name}</span> is live.</p>
      <button onClick={() => { setStep('intro'); setSerialStatus('disconnected'); portRef.current = null; }} className="text-indigo-600 font-bold pt-10">DASHBOARD</button>
    </div>
  );

  const renderRepeaterError = () => (
    <div className="space-y-8 text-center py-10 animate-in fade-in zoom-in duration-300">
      <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto"><AlertTriangle size={40} /></div>
      <div>
        <h2 className="text-2xl font-bold text-red-900">Repeater Error</h2>
        <p className="text-gray-500 text-sm mt-2 max-w-xs mx-auto">
          {errorMsg || "Failed to inject Repeater OS into the controller."}
        </p>
      </div>
      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <button onClick={() => goTo('repeater_connect')} className="px-10 py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2">
          <RefreshCw size={18} /> RETRY INJECTION
        </button>
        <button onClick={() => setShowTerminal(true)} className="text-xs text-indigo-600 font-bold">OPEN DEBUG CONSOLE</button>
      </div>
    </div>
  );

  const stepRenderer: Record<string, () => React.ReactNode> = {
    intro: renderIntro,
    client_explain: renderClientExplain, client_select_device: renderClientSelectDevice, client_connect: renderClientConnect,
    client_flashing: renderClientFlashing, client_error: renderClientError, client_restart: renderClientRestart, client_name: renderClientName, client_ready: renderClientReady,
    repeater_explain: renderRepeaterExplain, repeater_select_device: renderRepeaterSelectDevice, repeater_connect: renderRepeaterConnect,
    repeater_flashing: renderRepeaterFlashing, repeater_error: renderRepeaterError, repeater_restart: renderRepeaterRestart, repeater_config: renderRepeaterConfig, repeater_ready: renderRepeaterReady
  };

  return (
    <div className="min-h-screen bg-white md:bg-gray-50 flex items-center justify-center p-0 md:p-4 font-sans selection:bg-blue-100 selection:text-blue-900">
      <div className="w-full max-w-2xl bg-white md:rounded-[40px] md:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] overflow-hidden min-h-[100dvh] md:min-h-[600px] flex flex-col relative border-0 md:border md:border-gray-100">
        <div className="h-1.5 w-full bg-gray-50">
          <div className={`h-full transition-all duration-700 ease-in-out ${step.startsWith('repeater') ? 'bg-indigo-600' : 'bg-blue-600'}`} style={{ width: `${getProgress()}%` }} />
        </div>
        <div className="flex-1 p-8 sm:p-16 flex flex-col justify-center text-gray-900 relative">
          {stepRenderer[step]()}
        </div>
      </div>
      {renderTerminal()}
      {showMapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex h-full max-h-[92vh] w-full max-w-6xl flex-col rounded-3xl bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-gray-900">Set Repeater Coordinates</h3>
                <p className="text-xs text-gray-500">Click the US map or enter latitude and longitude manually.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMapModal(false)}
                className="rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-900"
                aria-label="Close map"
              >
                <X size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1">{renderRepeaterLocationMap(true)}</div>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                Latitude
                <input
                  type="number"
                  step="0.000001"
                  value={repeaterConfig.lat.toFixed(6)}
                  onChange={(e) => handleCoordinateChange('lat', e.target.value)}
                  className="mt-1 w-full rounded-lg border p-3 text-sm font-normal text-gray-900"
                />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                Longitude
                <input
                  type="number"
                  step="0.000001"
                  value={repeaterConfig.lon.toFixed(6)}
                  onChange={(e) => handleCoordinateChange('lon', e.target.value)}
                  className="mt-1 w-full rounded-lg border p-3 text-sm font-normal text-gray-900"
                />
              </label>
              <button
                type="button"
                onClick={() => setShowMapModal(false)}
                className="self-end rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-700"
              >
                USE LOCATION
              </button>
            </div>
          </div>
        </div>
      )}
      <style jsx global>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
}
