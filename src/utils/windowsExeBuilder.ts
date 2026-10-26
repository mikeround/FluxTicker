import { AppConfiguration, TickerItem } from '../types/ticker';

/**
 * Synthesizes a genuine 64-bit Windows PE32+ GUI Executable (.exe) binary
 * ("Sin licencia y para uso propio") that embeds the complete standalone
 * Flux Ticker HTML/JS/CSS application along with the user's exact current
 * configuration (bands, speeds, colors, sources, profiles, and cached items)
 * and launches it as a native desktop app window on Windows 10/11 with an
 * automatic local WMI hardware sensor bridge on 127.0.0.1:8765.
 */
export function buildPersonalWindowsExeBytes(
  baseStandaloneHtml: string,
  currentConfig: AppConfiguration,
  currentItemsMap: Record<string, TickerItem[]> = {}
): Uint8Array {
  // 1. Inject the user's current live configuration & cached items into the HTML payload
  const safeConfigJson = JSON.stringify({
    ...currentConfig,
    hardwareAgent: {
      ...currentConfig.hardwareAgent,
      enabled: true,
      endpointUrl: 'http://127.0.0.1:8765/api/sensors/',
    },
  }).replace(/<\/script/gi, '<\\/script');

  const safeItemsJson = JSON.stringify(currentItemsMap).replace(
    /<\/script/gi,
    '<\\/script'
  );

  const preloadScript = `<script id="flux-ticker-preloaded-state">
/* FLUX TICKER — Ejecutable Personal (.EXE) — Sin licencia y para uso propio */
window.__FLUX_PERSONAL_EXE_MODE__ = true;
window.__FLUX_LICENSE_INFO__ = "Versión personal libre de licencias y restricciones — Uso propio del usuario.";
window.__FLUX_PRELOADED_CONFIG__ = ${safeConfigJson};
window.__FLUX_PRELOADED_ITEMS__ = ${safeItemsJson};
</script>`;

  const customizedHtml = baseStandaloneHtml.includes('</head>')
    ? baseStandaloneHtml.replace('</head>', () => `${preloadScript}\n</head>`)
    : `${preloadScript}\n${baseStandaloneHtml}`;

  // Ensure the payload starts with <!doctype html> so the extractor locates it cleanly
  const htmlPayloadString = customizedHtml.trimStart().startsWith('<!')
    ? customizedHtml.trimStart()
    : `<!doctype html>\n${customizedHtml}`;

  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(`\n<!--FLUX_TICKER_APP_START-->\n${htmlPayloadString}`);

  // 2. Construct the 5120-byte (0x1400) native x86_64 PE32+ Windows GUI Executable header & sections
  // Layout:
  // 0x0000 - 0x01FF : DOS Header + PE32+ Header + Section Headers (SizeOfHeaders = 0x200)
  // 0x0200 - 0x03FF : .text section (RVA 0x1000, RawSize 0x200)
  // 0x0400 - 0x13FF : .rdata/.data section (RVA 0x2000, RawSize 0x1000)
  // 0x1400 - end    : PE Overlay containing the self-contained HTML+Config payload
  const peHeaderAndSectionsSize = 0x1400; // 5120 bytes
  const exeBytes = new Uint8Array(peHeaderAndSectionsSize + payloadBytes.length);
  const view = new DataView(exeBytes.buffer);

  const writeAscii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      exeBytes[offset + i] = str.charCodeAt(i) & 0xff;
    }
  };

  // --- DOS HEADER (0x0000) ---
  writeAscii(0x00, 'MZ'); // e_magic
  view.setUint32(0x3c, 0x80, true); // e_lfanew -> PE header at 0x80

  // --- PE32+ SIGNATURE & COFF FILE HEADER (0x0080) ---
  writeAscii(0x80, 'PE\0\0');
  view.setUint16(0x84, 0x8664, true); // Machine: IMAGE_FILE_MACHINE_AMD64
  view.setUint16(0x86, 2, true); // NumberOfSections: 2 (.text, .rdata)
  view.setUint32(0x88, Math.floor(Date.now() / 1000), true); // TimeDateStamp
  view.setUint32(0x8c, 0, true); // PointerToSymbolTable
  view.setUint32(0x90, 0, true); // NumberOfSymbols
  view.setUint16(0x94, 0xf0, true); // SizeOfOptionalHeader (240 bytes for PE32+)
  view.setUint16(0x96, 0x0022, true); // Characteristics: EXECUTABLE_IMAGE | LARGE_ADDRESS_AWARE

  // --- OPTIONAL HEADER PE32+ (0x0098 to 0x0187) ---
  const opt = 0x98;
  view.setUint16(opt + 0x00, 0x020b, true); // Magic: PE32+ (64-bit)
  exeBytes[opt + 0x02] = 14; // MajorLinkerVersion
  exeBytes[opt + 0x03] = 0; // MinorLinkerVersion
  view.setUint32(opt + 0x04, 0x0200, true); // SizeOfCode
  view.setUint32(opt + 0x08, 0x1000, true); // SizeOfInitializedData
  view.setUint32(opt + 0x0c, 0, true); // SizeOfUninitializedData
  view.setUint32(opt + 0x10, 0x1000, true); // AddressOfEntryPoint (RVA 0x1000)
  view.setUint32(opt + 0x14, 0x1000, true); // BaseOfCode (RVA 0x1000)
  // ImageBase: 0x0000000140000000 (standard 64-bit base)
  view.setUint32(opt + 0x18, 0x00000000, true);
  view.setUint32(opt + 0x1c, 0x00000001, true);
  view.setUint32(opt + 0x20, 0x1000, true); // SectionAlignment
  view.setUint32(opt + 0x24, 0x0200, true); // FileAlignment
  view.setUint16(opt + 0x28, 6, true); // MajorOperatingSystemVersion
  view.setUint16(opt + 0x2a, 0, true); // MinorOperatingSystemVersion
  view.setUint16(opt + 0x2c, 1, true); // MajorImageVersion
  view.setUint16(opt + 0x2e, 0, true); // MinorImageVersion
  view.setUint16(opt + 0x30, 6, true); // MajorSubsystemVersion (Windows Vista/7/10/11)
  view.setUint16(opt + 0x32, 0, true); // MinorSubsystemVersion
  view.setUint32(opt + 0x34, 0, true); // Win32VersionValue
  view.setUint32(opt + 0x38, 0x3000, true); // SizeOfImage (headers + .text + .rdata aligned to 0x1000)
  view.setUint32(opt + 0x3c, 0x0200, true); // SizeOfHeaders
  view.setUint32(opt + 0x40, 0, true); // CheckSum
  view.setUint16(opt + 0x44, 2, true); // Subsystem: IMAGE_SUBSYSTEM_WINDOWS_GUI (2 = no console flash)
  view.setUint16(opt + 0x46, 0x0100, true); // DllCharacteristics: NX_COMPAT
  // Stack & Heap reserves/commits
  view.setUint32(opt + 0x48, 0x00100000, true); // SizeOfStackReserve
  view.setUint32(opt + 0x50, 0x00001000, true); // SizeOfStackCommit
  view.setUint32(opt + 0x58, 0x00100000, true); // SizeOfHeapReserve
  view.setUint32(opt + 0x60, 0x00001000, true); // SizeOfHeapCommit
  view.setUint32(opt + 0x68, 0, true); // LoaderFlags
  view.setUint32(opt + 0x6c, 16, true); // NumberOfRvaAndSizes

  // Data Directory[1]: Import Table at RVA 0x2000, Size 0x28 (2 descriptors)
  view.setUint32(opt + 0x78, 0x2000, true);
  view.setUint32(opt + 0x7c, 0x0028, true);
  // Data Directory[12]: IAT at RVA 0x2050, Size 0x28
  view.setUint32(opt + 0xd0, 0x2050, true);
  view.setUint32(opt + 0xd4, 0x0028, true);

  // --- SECTION HEADERS (0x0188) ---
  // Section 1: .text
  const sec1 = 0x188;
  writeAscii(sec1 + 0x00, '.text\0\0\0');
  view.setUint32(sec1 + 0x08, 0x0200, true); // VirtualSize
  view.setUint32(sec1 + 0x0c, 0x1000, true); // VirtualAddress (RVA 0x1000)
  view.setUint32(sec1 + 0x10, 0x0200, true); // SizeOfRawData
  view.setUint32(sec1 + 0x14, 0x0200, true); // PointerToRawData (File offset 0x0200)
  view.setUint32(sec1 + 0x24, 0x60000020, true); // Characteristics: CODE | EXECUTE | READ

  // Section 2: .rdata (Read/Write initialized data for imports, command line, and path buffer)
  const sec2 = 0x1b0;
  writeAscii(sec2 + 0x00, '.rdata\0\0');
  view.setUint32(sec2 + 0x08, 0x1000, true); // VirtualSize
  view.setUint32(sec2 + 0x0c, 0x2000, true); // VirtualAddress (RVA 0x2000)
  view.setUint32(sec2 + 0x10, 0x1000, true); // SizeOfRawData
  view.setUint32(sec2 + 0x14, 0x0400, true); // PointerToRawData (File offset 0x0400)
  view.setUint32(sec2 + 0x24, 0xc0000040, true); // Characteristics: INITIALIZED_DATA | READ | WRITE

  // --- .rdata SECTION (File offset 0x0400 -> RVA 0x2000) ---
  // RVA 0x2000: IMAGE_IMPORT_DESCRIPTOR for KERNEL32.dll (20 bytes) + Null descriptor (20 bytes)
  // RVA 0x2028: OriginalFirstThunk (ILT: 4 x 8-byte RVAs + 8-byte null = 40 bytes)
  // RVA 0x2050: FirstThunk (IAT: 4 x 8-byte RVAs + 8-byte null = 40 bytes)
  // RVA 0x2078: "KERNEL32.dll\0"
  // RVA 0x2088: Hint/Name for GetModuleFileNameA
  // RVA 0x20A0: Hint/Name for SetEnvironmentVariableA
  // RVA 0x20C0: Hint/Name for WinExec
  // RVA 0x20CC: Hint/Name for ExitProcess
  // RVA 0x20DC: "FLUX_EXE\0"
  // RVA 0x20E8: Command Line string for WinExec
  // RVA 0x2A00: Writable 512-byte buffer for GetModuleFileNameA
  const rdataFileOffset = 0x0400;
  const rvaToFile = (rva: number) => rdataFileOffset + (rva - 0x2000);

  // Import Descriptor[0]: KERNEL32.dll
  view.setUint32(rvaToFile(0x2000) + 0x00, 0x2028, true); // OriginalFirstThunk (ILT)
  view.setUint32(rvaToFile(0x2000) + 0x04, 0, true); // TimeDateStamp
  view.setUint32(rvaToFile(0x2000) + 0x08, 0, true); // ForwarderChain
  view.setUint32(rvaToFile(0x2000) + 0x0c, 0x2078, true); // Name RVA ("KERNEL32.dll")
  view.setUint32(rvaToFile(0x2000) + 0x10, 0x2050, true); // FirstThunk (IAT)

  const hintRvas = [0x2088, 0x20a0, 0x20c0, 0x20cc];
  hintRvas.forEach((hRva, i) => {
    // Write 64-bit RVA into ILT (0x2028) and IAT (0x2050)
    view.setUint32(rvaToFile(0x2028 + i * 8), hRva, true);
    view.setUint32(rvaToFile(0x2050 + i * 8), hRva, true);
  });

  writeAscii(rvaToFile(0x2078), 'KERNEL32.dll\0');
  writeAscii(rvaToFile(0x2088 + 2), 'GetModuleFileNameA\0');
  writeAscii(rvaToFile(0x20a0 + 2), 'SetEnvironmentVariableA\0');
  writeAscii(rvaToFile(0x20c0 + 2), 'WinExec\0');
  writeAscii(rvaToFile(0x20cc + 2), 'ExitProcess\0');
  writeAscii(rvaToFile(0x20dc), 'FLUX_EXE\0');

  // PowerShell script encoded as UTF-16LE Base64 for -EncodedCommand (zero escaping issues):
  const psScript = [
    `$p = $env:FLUX_EXE`,
    `if (-not $p -or -not (Test-Path $p)) {`,
    `  $p = (Get-ChildItem -Path .,"$HOME\\Downloads","$HOME\\Desktop" -Filter *.exe -ErrorAction SilentlyContinue | Where-Object { $_.Length -gt 200000 } | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName`,
    `}`,
    `$d = Join-Path $env:LOCALAPPDATA 'FluxTicker'`,
    `New-Item -ItemType Directory -Force -Path $d | Out-Null`,
    `$h = Join-Path $d 'Flux-Ticker-App.html'`,
    `if ($p -and (Test-Path $p)) {`,
    `  $t = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)`,
    `  $i = $t.IndexOf('<!doctype html>', [System.StringComparison]::OrdinalIgnoreCase)`,
    `  if ($i -ge 0) { [System.IO.File]::WriteAllText($h, $t.Substring($i), [System.Text.Encoding]::UTF8) }`,
    `}`,
    `Start-Job -ScriptBlock {`,
    `  try {`,
    `    $l = New-Object System.Net.HttpListener`,
    `    $l.Prefixes.Add('http://127.0.0.1:8765/api/sensors/')`,
    `    $l.Start()`,
    `    while ($l.IsListening) {`,
    `      $c = $l.GetContext()`,
    `      $r = $c.Response`,
    `      $r.Headers.Add('Access-Control-Allow-Origin', '*')`,
    `      $cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average`,
    `      $os = Get-CimInstance Win32_OperatingSystem`,
    `      $ru = [math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / 1MB, 1)`,
    `      $rt = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)`,
    `      $rf = [math]::Round($os.FreePhysicalMemory / 1MB, 1)`,
    `      $dk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"`,
    `      $df = [math]::Round($dk.FreeSpace / 1GB, 1)`,
    `      $json = @{ status='DIRECTO'; cpuUsagePercent=$cpu; ramUsedGb=$ru; ramFreeGb=$rf; ramTotalGb=$rt; diskFreeGb=$df } | ConvertTo-Json -Compress`,
    `      $b = [System.Text.Encoding]::UTF8.GetBytes($json)`,
    `      $r.ContentType = 'application/json'`,
    `      $r.ContentLength64 = $b.Length`,
    `      $r.OutputStream.Write($b, 0, $b.Length)`,
    `      $r.OutputStream.Close()`,
    `    }`,
    `  } catch {}`,
    `} | Out-Null`,
    `$fileUri = 'file:///' + $h.Replace('\\', '/')`,
    `Start-Process 'msedge.exe' -ArgumentList @("--app=$fileUri", '--window-size=1440,820') -ErrorAction SilentlyContinue`,
    `if (-not $?) { Start-Process $h }`,
  ].join('\n');

  // Encode psScript as UTF-16LE Base64
  const utf16Bytes = new Uint8Array(psScript.length * 2);
  for (let i = 0; i < psScript.length; i++) {
    const code = psScript.charCodeAt(i);
    utf16Bytes[i * 2] = code & 0xff;
    utf16Bytes[i * 2 + 1] = (code >> 8) & 0xff;
  }
  let binaryStr = '';
  for (let i = 0; i < utf16Bytes.length; i++) {
    binaryStr += String.fromCharCode(utf16Bytes[i]);
  }
  const encodedPs =
    typeof btoa === 'function'
      ? btoa(binaryStr)
      : Buffer.from(utf16Bytes).toString('base64');

  const psCommand = `powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -EncodedCommand ${encodedPs}`;

  writeAscii(rvaToFile(0x20e8), psCommand + '\0');

  // --- .text SECTION (File offset 0x0200 -> RVA 0x1000) ---
  // x86_64 machine code with exact RIP-relative displacements:
  const textFileOffset = 0x0200;
  let pos = 0;
  const emit = (...bytes: number[]) => {
    for (const b of bytes) {
      exeBytes[textFileOffset + pos] = b & 0xff;
      pos++;
    }
  };
  const emitDisp32 = (targetRva: number) => {
    const nextInstrRva = 0x1000 + pos + 4;
    const disp = targetRva - nextInstrRva;
    view.setInt32(textFileOffset + pos, disp, true);
    pos += 4;
  };

  // 1. Align stack & allocate 32-byte shadow space: sub rsp, 0x28
  emit(0x48, 0x83, 0xec, 0x28);

  // 2. GetModuleFileNameA(NULL, RVA 0x2A00, 512)
  emit(0x31, 0xc9); // xor ecx, ecx
  emit(0x48, 0x8d, 0x15); // lea rdx, [rip + disp32 -> 0x2A00]
  emitDisp32(0x2a00);
  emit(0x41, 0xb8, 0x00, 0x02, 0x00, 0x00); // mov r8d, 512
  emit(0xff, 0x15); // call qword ptr [rip + disp32 -> IAT 0x2050 (GetModuleFileNameA)]
  emitDisp32(0x2050);

  // 3. SetEnvironmentVariableA("FLUX_EXE" at 0x20DC, RVA 0x2A00)
  emit(0x48, 0x8d, 0x0d); // lea rcx, [rip + disp32 -> 0x20DC]
  emitDisp32(0x20dc);
  emit(0x48, 0x8d, 0x15); // lea rdx, [rip + disp32 -> 0x2A00]
  emitDisp32(0x2a00);
  emit(0xff, 0x15); // call qword ptr [rip + disp32 -> IAT 0x2058 (SetEnvironmentVariableA)]
  emitDisp32(0x2058);

  // 4. WinExec(psCommand at 0x20E8, SW_HIDE = 0)
  emit(0x48, 0x8d, 0x0d); // lea rcx, [rip + disp32 -> 0x20E8]
  emitDisp32(0x20e8);
  emit(0x31, 0xd2); // xor edx, edx (SW_HIDE = 0)
  emit(0xff, 0x15); // call qword ptr [rip + disp32 -> IAT 0x2060 (WinExec)]
  emitDisp32(0x2060);

  // 5. ExitProcess(0)
  emit(0x31, 0xc9); // xor ecx, ecx
  emit(0xff, 0x15); // call qword ptr [rip + disp32 -> IAT 0x2068 (ExitProcess)]
  emitDisp32(0x2068);

  // 6. Epilogue fallback: add rsp, 0x28; ret
  emit(0x48, 0x83, 0xc4, 0x28, 0xc3);

  // --- APPEND SELF-CONTAINED HTML + CONFIG PAYLOAD AT OFFSET 0x0A00 ---
  exeBytes.set(payloadBytes, peHeaderAndSectionsSize);

  return exeBytes;
}
