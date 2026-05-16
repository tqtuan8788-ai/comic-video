import { SceneFull, StoryAnalysis, Character, ArtStyle } from '../types';
import { STYLE_PROMPTS } from '../prompts/artStyles';

export type VeoAspectRatio = '9:16' | '16:9';
export type VeoClipDuration = 4 | 6 | 8;
export type VeoMotionIntensity = 'subtle' | 'medium' | 'strong';

export interface VeoPromptExportOptions {
  aspectRatio: VeoAspectRatio;
  clipDurationSec: VeoClipDuration;
  motionIntensity: VeoMotionIntensity;
  includeTimestampBeats: boolean;
  includeTransitions: boolean;
  includeAudioNotes: boolean;
  useIngredients: boolean;
  strictDirectorMode: boolean;
  safetyRewrite: boolean;
  anonymizeSubjects: boolean;
  subjectFromImageOnly: boolean;
  useVisualPromptAnchor: boolean;
}

export type VeoLintLevel = 'error' | 'warn' | 'info';

export interface VeoLintIssue {
  level: VeoLintLevel;
  code: string;
  message: string;
  sceneIds?: number[];
  clipId?: string;
}

export interface VeoClipPrompt {
  clipId: string;
  type: 'scene' | 'transition';
  sceneIds: number[];
  title: string;
  recommendedInputs: Array<
    | { kind: 'scene_image'; sceneId: number }
    | { kind: 'character_reference'; name: string }
    | { kind: 'first_last_frames'; firstSceneId: number; lastSceneId: number }
  >;
  prompt: string;
  negativePrompt: string;
  notes: string[];
  lint: VeoLintIssue[];
}

export interface VeoPromptPack {
  version: string;
  createdAt: string;
  options: VeoPromptExportOptions;
  globalBible: {
    world: string;
    characters: string;
    cinematography: string;
    negatives: string;
  };
  clips: VeoClipPrompt[];
  lint: VeoLintIssue[];
}

const normalize = (input: string) => (input || '').replace(/\s+/g, ' ').trim();

const safetyRewriteText = (input: string) => {
  let out = input || '';
  const rules: Array<[RegExp, string]> = [
    [/Ai\s+thực\s+sự\s+điều\s+khiển\s+thế\s+giới\s+này\?/gi, 'Ai đang kết nối những trung tâm quyền lực này?'],
    [/điều\s+khiển\s+thế\s+giới/gi, 'tác động lên cán cân quyền lực toàn cầu'],
    [/mạng\s+lưới\s+quyền\s+lực\s+ngầm/gi, 'mạng lưới lợi ích phức tạp'],
    [/quyền\s+lực\s+ngầm/gi, 'hành lang quyền lực'],
    [/thao\s+túng/gi, 'tác động'],
    [/cabal/gi, 'inner circle'],
    [/deep\s*state/gi, 'power network'],
    [/Illuminati/gi, 'secret society (fictional)'],
    [/\bma\s*t(?:u|\u00FA)(?:y|\u00FD)\b/gi, 'hang cam'],
    [/\bcocaine\b/gi, 'illicit goods'],
    [/\bheroin\b/gi, 'illicit goods'],
    [/\bmeth(amphetamine)?\b/gi, 'illicit goods'],
    [/\bfentanyl\b/gi, 'illicit goods'],
    [/\bdrug(s)?\b/gi, 'illicit goods'],
    [/\bnarcotic(s)?\b/gi, 'illicit goods'],
    [/\bcartel\b/gi, 'criminal network'],
    [/\btraffick(ing|er|ers)?\b/gi, 'smuggling'],
    [/\bsmuggl(ing|er|ers)?\b/gi, 'smuggling'],
  ];

  for (const [re, rep] of rules) out = out.replace(re, rep);
  return out;
};

const maybeAddFictionDisclaimer = (input: string) => {
  const p = input || '';
  const disclaimer = 'Ghi chú: Bối cảnh hư cấu; tránh ngụ ý/cáo buộc thực tế về cá nhân hoặc tổ chức có thật.';
  return p.includes('Bối cảnh hư cấu') ? p : `${disclaimer}\n${p}`;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildCharacterAliasMap = (analysis?: StoryAnalysis | null) => {
  const chars = (analysis?.characters || []).filter(Boolean);
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const map = new Map<string, string>();
  for (let i = 0; i < chars.length; i++) {
    const name = normalize(chars[i]?.name || '');
    if (!name) continue;
    const label = letters[i] ? `Nhân vật ${letters[i]}` : `Nhân vật ${i + 1}`;
    map.set(name, label);

    const tokens = name.split(' ').filter(Boolean);
    if (tokens.length > 1) {
      const stop = new Set(['the', 'of', 'and', 'da', 'de', 'di', 'la', 'van', 'von']);
      for (const token of tokens) {
        if (token.length < 4) continue;
        if (stop.has(token.toLowerCase())) continue;
        map.set(token, label);
      }
    }

    const desc = normalize(chars[i]?.description || '');
    if (desc) {
      const quoteRegex = /["“”'‘’]([^"“”'‘’]{2,40})["“”'‘’]/g;
      let match: RegExpExecArray | null;
      while ((match = quoteRegex.exec(desc))) {
        const alias = normalize(match[1]);
        if (alias) map.set(alias, label);
      }
    }
  }
  return map;
};

const replaceCharacterNames = (input: string, aliasMap: Map<string, string>) => {
  if (!input) return '';
  let out = input;
  for (const [name, alias] of aliasMap.entries()) {
    if (!name) continue;
    const isSingleToken = /^[A-Za-z0-9_-]+$/.test(name);
    const re = isSingleToken
      ? new RegExp(`\\b${escapeRegExp(name)}\\b`, 'gi')
      : new RegExp(escapeRegExp(name), 'gi');
    out = out.replace(re, alias);
  }
  return out;
};

const stripTextOverlayHints = (input: string) => {
  let out = input || '';
  const rules: RegExp[] = [
    /on[- ]screen text\s*:\s*[^.]+\.?/gi,
    /hiển thị on[- ]screen text\s*:\s*[^.]+\.?/gi,
    /subtitle\s*:\s*[^.]+\.?/gi,
    /text overlay\s*:\s*[^.]+\.?/gi
  ];
  for (const re of rules) out = out.replace(re, '');
  return normalize(out);
};

const scrubResidualProperNames = (input: string, aliasMap: Map<string, string>) => {
  let out = input || '';
  const fallback = aliasMap.values().next().value || 'nhân vật';
  out = out.replace(/\bFBI\b/gi, 'cơ quan liên bang');
  out = out.replace(/\bCIA\b/gi, 'cơ quan tình báo');
  out = out.replace(/\bNew York\b/gi, 'thành phố lớn');
  out = out.replace(/\bHollywood\b/gi, 'điện ảnh đại chúng');
  out = out.replace(/\bGambino\b/gi, fallback);
  out = out.replace(/\bTeflon Don\b/gi, fallback);
  out = out.replace(/\bPablo\b/gi, fallback);
  out = out.replace(/\bEscobar\b/gi, fallback);
  out = out.replace(/\bGotti\b/gi, fallback);
  out = out.replace(/\bColombia\b/gi, 'mot nuoc Nam My');
  out = out.replace(/\bColombian\b/gi, 'Nam My');
  out = out.replace(/\bMedell(?:in|\u00EDn)\b/gi, 'mot thanh pho Nam My');
  const safeTokens = new Set([
    'Camera', 'Motion', 'Cinematography', 'Composition', 'Aspect', 'Rule', 'Thirds', 'Depth', 'Field',
    'Foreground', 'Background', 'Subject', 'Action', 'Context', 'Style', 'Ambiance', 'Timestamp', 'Ending',
    'Transition', 'Scene', 'Clip', 'Wide', 'Medium', 'Close', 'Extreme', 'Long', 'Shot', 'Angle', 'High',
    'Low', 'Over', 'Shoulder', 'POV', 'Dolly', 'Crane', 'Tracking', 'Pan', 'Tilt', 'Zoom', 'Establishing',
    'Insert', 'Macro', 'Detail', 'Silhouette', 'Backlight', 'Lighting', 'Focus', 'Frame', 'Lens', 'Portrait',
    'Vertical', 'Horizontal', 'Story', 'World', 'Hook', 'Reveal', 'Build', 'Ending', 'Cinematic', 'Filmic',
    'Digital', 'Painting', 'Illustration', 'Fidelity'
  ]);
  out = out.replace(/\b([A-Z][a-z]{2,})(?:\s+[A-Z][a-z]{2,})+\b/g, (match) => {
    const tokens = match.split(/\s+/);
    if (tokens.some((t) => safeTokens.has(t))) return match;
    return fallback;
  });
  return normalize(out);
};

const clampWords = (input: string, maxWords: number): string => {
  const words = normalize(input).split(' ').filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return words.slice(0, maxWords).join(' ');
};

const timecode = (sec: number) => `00:${sec.toString().padStart(2, '0')}`;

const splitIntoBeats = (text: string, duration: number): Array<{ start: number; end: number; text: string }> => {
  const clean = normalize(text);
  if (!clean) {
    return [
      { start: 0, end: 2, text: 'Thiết lập bối cảnh và cảm xúc.' },
      { start: 2, end: 4, text: 'Hành động chính bắt đầu.' },
      { start: 4, end: 6, text: 'Căng thẳng tăng, chi tiết quan trọng lộ ra.' },
      { start: 6, end: duration, text: 'Giữ khung hình êm để nối sang clip tiếp theo.' }
    ];
  }

  const words = clean.split(' ').filter(Boolean);
  const segments = 4;
  const per = Math.max(1, Math.floor(words.length / segments));
  const parts: string[] = [];
  for (let i = 0; i < segments; i++) {
    const start = i * per;
    const end = i === segments - 1 ? words.length : (i + 1) * per;
    parts.push(words.slice(start, end).join(' '));
  }
  const ends = duration === 4 ? [1, 2, 3, 4] : duration === 6 ? [2, 3, 4, 6] : [2, 4, 6, 8];
  return [
    { start: 0, end: ends[0], text: parts[0] || clean },
    { start: ends[0], end: ends[1], text: parts[1] || clean },
    { start: ends[1], end: ends[2], text: parts[2] || clean },
    { start: ends[2], end: ends[3], text: parts[3] || clean }
  ].map((b) => ({ ...b, text: clampWords(b.text, 22) }));
};

const motionStyle = (intensity: VeoMotionIntensity) => {
  switch (intensity) {
    case 'subtle':
      return {
        camera: 'locked-off hoặc dolly-in rất nhẹ, ổn định, không rung vô ý',
        subject: 'cử động nhỏ, tự nhiên: ánh mắt, hơi thở, tay chạm đạo cụ, vải áo lay nhẹ'
      };
    case 'strong':
      return {
        camera: 'handheld có chủ ý hoặc tracking nhanh, vẫn phải giữ chủ thể trong khung, không drift',
        subject: 'hành động rõ, tốc độ cao hơn, phản ứng mạnh, nhưng không méo hình'
      };
    default:
      return {
        camera: 'tracking/dolly vừa phải, pan nhẹ theo hành động, ổn định',
        subject: 'cử động tự nhiên, rõ ý, không giật'
      };
  }
};

const styleForArt = (artStyle: ArtStyle) => {
  const name = STYLE_PROMPTS?.[artStyle]?.name || String(artStyle);
  switch (artStyle) {
    case (ArtStyle as any).COMIC_MANHUA:
      return `${name}; comic manhua cinematic; linework sắc, shading rõ; chuyển động kiểu 2.5D/parallax, giữ chất tranh`;
    case (ArtStyle as any).INK_WASH:
      return `${name}; ink wash; brush texture; chuyển động nhẹ, thơ, ít rung; giữ giấy/ink grain`;
    case (ArtStyle as any).HORROR_GLITCH:
      return `${name}; horror glitch aesthetic; harsh contrast; cold, desaturated palette; VHS noise, scanlines, subtle chromatic aberration; gritty texture; no unstable flicker`;
    case (ArtStyle as any).CINEMATIC:
      return `${name}; live-action cinematic; filmic lighting; DOF rõ; camera grammar chuẩn`;
    default:
      return `${name}; cinematic illustration; giữ palette ổn định; ánh sáng có direction rõ`;
  }
};

const defaultNegatives = (artStyle: ArtStyle) =>
  [
    'không subtitle, không caption, không chữ, không speech bubble',
    'không watermark UI, không logo, không brand names',
    'không biến dạng mặt/da, không đổi giới tính/tuổi, không đổi outfit/tóc',
    'không thêm nhân vật lạ, không thêm đạo cụ lạ không có trong cảnh',
    'không glitch, không flicker, không jump cut vô lý, không camera drift',
    'không tay thừa/khuyết, không ngón tay dị dạng'
  ].map((line) => {
    if (artStyle === (ArtStyle as any).HORROR_GLITCH && line.includes('glitch')) {
      return line.replace("khA'ng glitch, ", '');
    }
    return line;
  }).join('; ');

const inferShot = (scene: SceneFull): { shot: string; angle: string; movement: string } => {
  const sb = scene.storyboard || ({} as any);
  const shot = normalize(sb.shot) || (scene.type === 'HOOK' ? 'Close-up / Medium' : scene.type === 'REVEAL' ? 'Wide' : 'Medium');
  const angle = normalize(sb.angle) || (scene.type === 'HOOK' ? 'Eye-level' : 'Eye-level');
  const movement = normalize(sb.movement) || (scene.type === 'HOOK' ? 'Slow push-in' : scene.type === 'REVEAL' ? 'Crane up nhẹ' : 'Tracking nhẹ');
  return { shot, angle, movement };
};

const buildCharacterBible = (analysis: StoryAnalysis | null | undefined, options: VeoPromptExportOptions, aliasMap?: Map<string, string>) => {
  const chars = (analysis?.characters || []).filter(Boolean);
  const scrubNames = options.anonymizeSubjects || options.subjectFromImageOnly;
  const resolvedAliasMap = scrubNames
    ? (aliasMap || buildCharacterAliasMap(analysis || null))
    : new Map<string, string>();
  if (chars.length === 0) {
    return 'Nhân vật: N/A (hãy bổ sung ít nhất 1 nhân vật chính để tăng consistency).';
  }
  return chars
    .slice(0, 8)
    .map((c: Character) => {
      const rawName = normalize(c.name);
      const displayName = scrubNames ? (resolvedAliasMap.get(rawName) || 'Nhân vật') : rawName;
      let desc = scrubNames ? replaceCharacterNames(normalize(c.description), resolvedAliasMap) : normalize(c.description);
      if (scrubNames) {
        desc = scrubResidualProperNames(desc, resolvedAliasMap);
      }
      const role = normalize(c.role || '');
      const locks = [
        'giữ nguyên khuôn mặt theo ảnh tham chiếu (nếu có)',
        'giữ nguyên tóc/outfit/đặc điểm nhận dạng xuyên suốt',
        'không đổi tuổi/giới tính/ethnicity ngoài ý đồ kịch bản'
      ].join(', ');
      return `- ${displayName}${role ? ` (${role})` : ''}: ${desc || 'mô tả chưa có'}. Lock: ${locks}.`;
    })
    .join('\n');
};

const buildWorldBible = (analysis: StoryAnalysis | null | undefined, options: VeoPromptExportOptions, aliasMap?: Map<string, string>) => {
  const scrubNames = options.anonymizeSubjects || options.subjectFromImageOnly;
  const resolvedAliasMap = scrubNames
    ? (aliasMap || buildCharacterAliasMap(analysis || null))
    : new Map<string, string>();
  const themeRaw = normalize(analysis?.theme || '');
  let theme = scrubNames ? replaceCharacterNames(themeRaw, resolvedAliasMap) : themeRaw;
  const plotRaw = (analysis?.plot_points || []).map(normalize).filter(Boolean).slice(0, 4);
  let plot = scrubNames ? plotRaw.map((p) => replaceCharacterNames(p, resolvedAliasMap)) : plotRaw;
  const hooksRaw = (analysis?.hooks || []).map(normalize).filter(Boolean).slice(0, 2);
  let hooks = scrubNames ? hooksRaw.map((h) => replaceCharacterNames(h, resolvedAliasMap)) : hooksRaw;
  if (scrubNames) {
    theme = scrubResidualProperNames(theme, resolvedAliasMap);
    plot = plot.map((p) => scrubResidualProperNames(p, resolvedAliasMap));
    hooks = hooks.map((h) => scrubResidualProperNames(h, resolvedAliasMap));
  }
  const lines: string[] = [];
  if (theme) lines.push(`Chủ đề/World: ${theme}.`);
  if (plot.length) lines.push(`Cột mốc cốt truyện: ${plot.join(' | ')}.`);
  if (hooks.length) lines.push(`Hook intent: ${hooks.join(' | ')}.`);
  lines.push('Continuity lock: giữ cùng thời điểm trong ngày, thời tiết, palette, và đạo cụ chính giữa các clip trừ khi kịch bản yêu cầu thay đổi.');
  let out = lines.join('\n');
  if (options.safetyRewrite) out = safetyRewriteText(out);
  return out;
};

const buildCinematographyBible = (options: VeoPromptExportOptions, artStyle: ArtStyle) => {
  const style = styleForArt(artStyle);
  const motion = motionStyle(options.motionIntensity);
  return [
    `Tỉ lệ khung hình: ${options.aspectRatio}. Thời lượng clip: ~${options.clipDurationSec}s.`,
    `Phong cách hình ảnh: ${style}.`,
    `Quy tắc camera: nêu shot size sớm; tách rõ subject motion vs camera motion; ưu tiên composition có chiều sâu (foreground/background).`,
    `Camera motion mặc định: ${motion.camera}.`,
    `Subject motion mặc định: ${motion.subject}.`,
    `Quy tắc dựng/continuity: giữ trục nhìn 180°; nếu đổi góc đối diện hãy ghi rõ "reverse angle"; tránh đảo trái-phải vô cớ.`
  ].join('\n');
};

const buildSceneClipPrompt = (
  scene: SceneFull,
  analysis: StoryAnalysis | null | undefined,
  artStyle: ArtStyle,
  options: VeoPromptExportOptions,
  aliasMap?: Map<string, string>
) => {
  const shot = inferShot(scene);
  const sb = scene.storyboard || ({} as any);
  const scrubNames = options.anonymizeSubjects || options.subjectFromImageOnly;
  const resolvedAliasMap = scrubNames
    ? (aliasMap || buildCharacterAliasMap(analysis || null))
    : new Map<string, string>();
  const onScreenIntentRaw = normalize(sb.on_screen_text || '');
  let onScreenIntent = scrubNames ? replaceCharacterNames(onScreenIntentRaw, resolvedAliasMap) : onScreenIntentRaw;
  const visualPromptRaw = normalize(sb.visual_prompt || '');
  const visualPromptClean = stripTextOverlayHints(visualPromptRaw);
  let visualPrompt = scrubNames ? replaceCharacterNames(visualPromptClean, resolvedAliasMap) : visualPromptClean;
  const actionRawLong = normalize(sb.action || sb.visual_prompt || scene.summary || '');
  const actionRaw = clampWords(actionRawLong, 32);
  let action = scrubNames ? replaceCharacterNames(actionRaw, resolvedAliasMap) : actionRaw;
  const lightingRaw = normalize(sb.lighting || '');
  let lighting = scrubNames ? replaceCharacterNames(lightingRaw, resolvedAliasMap) : lightingRaw;
  const backgroundRaw = normalize(sb.background || '');
  let background = scrubNames ? replaceCharacterNames(backgroundRaw, resolvedAliasMap) : backgroundRaw;
  const voiceoverRaw = normalize(scene.voiceover_text || scene.summary || '');
  let voiceover = scrubNames ? replaceCharacterNames(voiceoverRaw, resolvedAliasMap) : voiceoverRaw;
  if (scrubNames) {
    onScreenIntent = scrubResidualProperNames(onScreenIntent, resolvedAliasMap);
    visualPrompt = scrubResidualProperNames(visualPrompt, resolvedAliasMap);
    action = scrubResidualProperNames(action, resolvedAliasMap);
    lighting = scrubResidualProperNames(lighting, resolvedAliasMap);
    background = scrubResidualProperNames(background, resolvedAliasMap);
    voiceover = scrubResidualProperNames(voiceover, resolvedAliasMap);
  }
  const charsInShot = Array.isArray(sb.characters) ? sb.characters : [];
  const charNames = charsInShot.map((c: any) => normalize(c?.name)).filter(Boolean);

  const motion = motionStyle(options.motionIntensity);
  const strict = options.strictDirectorMode;

  const promptLines: string[] = [];
  const shotText = scrubNames ? replaceCharacterNames(shot.shot, resolvedAliasMap) : shot.shot;
  const angleText = scrubNames ? replaceCharacterNames(shot.angle, resolvedAliasMap) : shot.angle;
  const movementTextRaw = normalize(shot.movement) || motion.camera;
  const movementText = scrubNames ? replaceCharacterNames(movementTextRaw, resolvedAliasMap) : movementTextRaw;
  promptLines.push(
    `Cinematography: ${shotText}, ${angleText}. Camera motion: ${movementText}. Composition: rule-of-thirds, depth-of-field rõ, foreground/background tách lớp. Aspect ${options.aspectRatio}.`
  );

  if (options.subjectFromImageOnly) {
    promptLines.push('Subject: implied by the input image; avoid naming or identifying any real person.');
  } else if (scrubNames) {
    const inShot = charNames
      .map((n) => resolvedAliasMap.get(normalize(n)) || 'Nhân vật')
      .filter(Boolean);
    const fallback = (analysis?.characters || [])
      .slice(0, 3)
      .map((c) => resolvedAliasMap.get(normalize(c.name)) || 'Nhân vật')
      .filter(Boolean);
    const subjects = inShot.length ? inShot : fallback.length ? fallback : ['nhân vật chính hư cấu'];
    promptLines.push(
      `Subject: ${subjects.join(', ')} (giữ nhất quán khuôn mặt/outfit theo ảnh tham chiếu; không dùng tên người thật).`
    );
  } else if (charNames.length) {
    promptLines.push(`Subject: ${charNames.join(', ')} (giữ nguyên khuôn mặt/outfit theo Character Bible và ảnh tham chiếu nếu có).`);
  } else if (analysis?.characters?.length) {
    const main = analysis.characters.slice(0, 2).map((c) => c.name).filter(Boolean).join(', ');
    if (main) promptLines.push(`Subject: ${main} (giữ nguyên khuôn mặt/outfit theo Character Bible và ảnh tham chiếu nếu có).`);
  } else {
    promptLines.push('Subject: nhân vật chính (giữ nguyên nhận dạng, không đổi tóc/outfit).');
  }

  if (options.useVisualPromptAnchor && visualPrompt) {
    promptLines.push(`Scene anchor (match the still image): ${clampWords(visualPrompt, 90)}.`);
  }

  const actionLine = strict
    ? `Action: ${action}. Micro-actions: ánh mắt, tay chạm đạo cụ, nhịp thở tự nhiên.`
    : `Action: ${action}.`;
  promptLines.push(actionLine);

  const contextBits = [
    background ? `Bối cảnh: ${background}.` : '',
    lighting ? `Ánh sáng: ${lighting}.` : ''
  ].filter(Boolean);
  if (contextBits.length) {
    promptLines.push(`Context: ${contextBits.join(' ')}`);
  } else if (visualPrompt) {
    promptLines.push(`Context: bám sát bối cảnh/đạo cụ/ánh sáng của ảnh tĩnh; key details: ${clampWords(visualPrompt, 40)}.`);
  } else {
    promptLines.push('Context: giữ đúng bối cảnh của ảnh nguồn; không tự ý đổi địa điểm/thời tiết.');
  }

  const style = styleForArt(artStyle);
  promptLines.push(`Style & ambiance: ${style}. Không render chữ lên khung hình; chỉ kể chuyện bằng hình ảnh và hành động.`);

  promptLines.push(`Motion channels: Subject motion = ${motion.subject}. Camera motion = ${motion.camera}.`);

  if (options.includeTimestampBeats) {
    const beats = splitIntoBeats(voiceover || action || visualPrompt || onScreenIntent, options.clipDurationSec);
    promptLines.push(
      `Timestamp beats:\n${beats
        .map((b) => `[${timecode(b.start)}-${timecode(b.end)}] ${b.text}`)
        .join('\n')}\n[${timecode(options.clipDurationSec - 1)}-${timecode(options.clipDurationSec)}] Giữ 0.5-1s cuối clip ổn định (end-pose) để nối clip sau.`
    );
  } else {
    promptLines.push('Ending continuity: giữ 0.5-1s cuối clip ổn định (end-pose), đạo cụ/ánh sáng không đổi, để nối clip sau.');
  }

  if (options.includeAudioNotes) {
    const sfx = normalize(sb.sound_effect || '');
    const audio = sfx ? `SFX: ${sfx}.` : 'SFX: ambience phù hợp, không lời thoại.';
    promptLines.push(`Audio: ${audio} (ưu tiên narration/voiceover được dựng ngoài, tránh subtitle burn-in).`);
  }

  let out = normalize(promptLines.join('\n'));
  if (options.safetyRewrite) {
    const before = out;
    out = safetyRewriteText(out);
    if (out !== before) out = maybeAddFictionDisclaimer(out);
  }
  return out;
};

const buildTransitionPrompt = (
  from: SceneFull,
  to: SceneFull,
  analysis: StoryAnalysis | null | undefined,
  artStyle: ArtStyle,
  options: VeoPromptExportOptions,
  aliasMap?: Map<string, string>
) => {
  const scrubNames = options.anonymizeSubjects || options.subjectFromImageOnly;
  const resolvedAliasMap = scrubNames
    ? (aliasMap || buildCharacterAliasMap(analysis || null))
    : new Map<string, string>();
  const fromIntentRaw = normalize(from.storyboard?.on_screen_text || from.summary || '');
  const toIntentRaw = normalize(to.storyboard?.on_screen_text || to.summary || '');
  let fromIntent = scrubNames ? replaceCharacterNames(fromIntentRaw, resolvedAliasMap) : fromIntentRaw;
  let toIntent = scrubNames ? replaceCharacterNames(toIntentRaw, resolvedAliasMap) : toIntentRaw;
  const motion = motionStyle(options.motionIntensity);
  const style = styleForArt(artStyle);
  const charsRaw = analysis?.characters?.slice(0, 3).map((c) => c.name).filter(Boolean).join(', ') || 'nhân vật chính';
  let chars = scrubNames ? replaceCharacterNames(charsRaw, resolvedAliasMap) : charsRaw;
  if (scrubNames) {
    fromIntent = scrubResidualProperNames(fromIntent, resolvedAliasMap);
    toIntent = scrubResidualProperNames(toIntent, resolvedAliasMap);
    chars = scrubResidualProperNames(chars, resolvedAliasMap);
  }
  const lines = [
    `Transition clip (first/last frame): dùng ảnh Scene ${from.id} làm FIRST frame và ảnh Scene ${to.id} làm LAST frame.`,
    `Cinematography: ${options.aspectRatio}, ~${options.clipDurationSec}s. Camera motion: ${motion.camera}.`,
    options.subjectFromImageOnly
      ? 'Subject: implied by the input images; avoid naming or identifying any real person.'
      : `Subject: ${chars} (giữ nguyên nhận dạng/outfit).`,
    `Action: chuyển động hợp lý để đi từ trạng thái Scene ${from.id} → Scene ${to.id}, không teleport, không đổi đạo cụ vô cớ.`,
    `Intent: từ "${clampWords(fromIntent, 10)}" sang "${clampWords(toIntent, 10)}".`,
    `Style & ambiance: ${style}. Không chữ/subtitle/watermark UI.`,
    `Motion channels: Subject motion = ${motion.subject}. Camera motion = ${motion.camera}.`
  ];
  let out = normalize(lines.join('\n'));
  if (options.safetyRewrite) {
    const before = out;
    out = safetyRewriteText(out);
    if (out !== before) out = maybeAddFictionDisclaimer(out);
  }
  return out;
};

const lintClip = (clip: VeoClipPrompt): VeoLintIssue[] => {
  const issues: VeoLintIssue[] = [];
  const p = clip.prompt.toLowerCase();

  const mustHave = ['cinematography', 'subject', 'action', 'context', 'style'];
  for (const key of mustHave) {
    if (!p.includes(key)) {
      issues.push({
        level: 'warn',
        code: 'missing_section',
        message: `Prompt thiếu section "${key}". Nên bổ sung để Veo bám tốt hơn.`,
        sceneIds: clip.sceneIds,
        clipId: clip.clipId
      });
    }
  }

  if (!p.includes('không render chữ') && !p.includes('không subtitle') && !p.includes('không chữ')) {
    issues.push({
      level: 'warn',
      code: 'missing_no_text',
      message: 'Nên thêm ràng buộc “không subtitle/không text overlay” để tránh chữ bị burn-in.',
      sceneIds: clip.sceneIds,
      clipId: clip.clipId
    });
  }

  if (!p.includes('end-pose') && !p.includes('hold')) {
    issues.push({
      level: 'info',
      code: 'missing_end_pose',
      message: 'Nên chỉ định end-pose/hold cuối clip để nối continuity clip sau mượt hơn.',
      sceneIds: clip.sceneIds,
      clipId: clip.clipId
    });
  }

  if (p.includes('then') || p.includes('after that')) {
    issues.push({
      level: 'info',
      code: 'temporal_connectors',
      message: 'Tránh “then/after that” trong clip độc lập; nên dùng timestamp beats hoặc mô tả tuyến tính.',
      sceneIds: clip.sceneIds,
      clipId: clip.clipId
    });
  }

  const policyRiskSignals = [
    'ai thực sự điều khiển',
    'điều khiển thế giới',
    'dieu khien the gioi',
    'quyền lực ngầm',
    'quyen luc ngam',
    'deep state',
    'illuminati',
    'cabal'
  ];
  if (policyRiskSignals.some((s) => p.includes(s))) {
    issues.push({
      level: 'warn',
      code: 'policy_risk',
      message:
        'Policy risk: conspiracy / real-world allegation framing. Consider enabling Safety rewrite and/or Anonymize subjects to reduce provider blocks.',
      sceneIds: clip.sceneIds,
      clipId: clip.clipId
    });
  }

  return issues;
};

export const buildVeoPromptPack = (params: {
  scenes: SceneFull[];
  analysis?: StoryAnalysis | null;
  artStyle: ArtStyle;
  options: VeoPromptExportOptions;
}): VeoPromptPack => {
  const { scenes, analysis, artStyle, options } = params;
  const safeScenes = [...(scenes || [])].sort((a, b) => a.id - b.id);
  const scrubNames = options.anonymizeSubjects || options.subjectFromImageOnly;
  const aliasMap = scrubNames ? buildCharacterAliasMap(analysis || null) : new Map<string, string>();
  if (scrubNames) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const existing = new Set(Array.from(aliasMap.keys()).map(normalize));
    let nextIndex = aliasMap.size;
    for (const s of safeScenes) {
      const sbChars = Array.isArray((s as any)?.storyboard?.characters) ? (s as any).storyboard.characters : [];
      for (const ch of sbChars) {
        const name = normalize((ch as any)?.name || '');
        if (!name || existing.has(name)) continue;
        const label = letters[nextIndex] ? `Nhân vật ${letters[nextIndex]}` : `Nhân vật ${nextIndex + 1}`;
        aliasMap.set(name, label);
        existing.add(name);
        nextIndex++;
      }
    }
  }

  const globalBible = {
    world: buildWorldBible(analysis || null, options, aliasMap),
    characters: buildCharacterBible(analysis || null, options, aliasMap),
    cinematography: buildCinematographyBible(options, artStyle),
    negatives: defaultNegatives(artStyle)
  };

  const clips: VeoClipPrompt[] = [];

  for (const scene of safeScenes) {
    const clipId = `scene-${scene.id}`;
    const prompt = buildSceneClipPrompt(scene, analysis || null, artStyle, options, aliasMap);
    const clip: VeoClipPrompt = {
      clipId,
      type: 'scene',
      sceneIds: [scene.id],
      title: `Scene ${scene.id} • ${scene.type}`,
      recommendedInputs: [
        { kind: 'scene_image', sceneId: scene.id },
        ...(options.useIngredients && (analysis?.characters || []).length
          ? analysis!.characters.slice(0, 3).map((c) => ({
            kind: 'character_reference' as const,
            name: scrubNames ? (aliasMap.get(normalize(c.name)) || 'Nhân vật') : c.name
          }))
          : [])
      ],
      prompt,
      negativePrompt: globalBible.negatives,
      notes: [
        'Trong Flow/Veo: dùng ảnh scene làm input (image-to-video).',
        'Không yêu cầu model render chữ; chữ/voiceover nên dựng ngoài (CapCut/Premiere/Resolve).',
        'Nếu bị drift, tăng “ingredients”: thêm ảnh tham chiếu nhân vật/bối cảnh và lặp lại Character Bible.'
      ],
      lint: []
    };
    clip.lint = lintClip(clip);
    clips.push(clip);
  }

  if (options.includeTransitions && safeScenes.length >= 2) {
    for (let i = 0; i < safeScenes.length - 1; i++) {
      const from = safeScenes[i];
      const to = safeScenes[i + 1];
      const clipId = `transition-${from.id}-${to.id}`;
      const prompt = buildTransitionPrompt(from, to, analysis || null, artStyle, options, aliasMap);
      const clip: VeoClipPrompt = {
        clipId,
        type: 'transition',
        sceneIds: [from.id, to.id],
        title: `Transition • ${from.id} → ${to.id}`,
        recommendedInputs: [{ kind: 'first_last_frames', firstSceneId: from.id, lastSceneId: to.id }],
        prompt,
        negativePrompt: globalBible.negatives,
        notes: ['Trong Flow/Veo: dùng first frame = Scene trước, last frame = Scene sau để chuyển cảnh mượt.'],
        lint: []
      };
      clip.lint = lintClip(clip);
      clips.push(clip);
    }
  }

  const lint = clips.flatMap((c) => c.lint);

  // Global lint: cảnh thiếu ảnh nguồn
  const missingSceneImages = safeScenes.filter((s) => !s.generated_image_url).map((s) => s.id);
  if (missingSceneImages.length) {
    lint.push({
      level: 'warn',
      code: 'missing_scene_images',
      message: `Có ${missingSceneImages.length} scene chưa có ảnh tĩnh (generated_image_url). Nếu muốn image-to-video đúng scene, hãy gen ảnh trước: ${missingSceneImages.join(', ')}.`,
      sceneIds: missingSceneImages
    });
  }

  const missingVisualPrompts = safeScenes
    .filter((s) => !normalize((s as any)?.storyboard?.visual_prompt || ''))
    .map((s) => s.id);
  if (options.useVisualPromptAnchor && missingVisualPrompts.length) {
    lint.push({
      level: 'info',
      code: 'missing_visual_prompt',
      message: `Có ${missingVisualPrompts.length} scene chưa có storyboard.visual_prompt. Nên tạo storyboard trước để prompt Veo bám sát ảnh: ${missingVisualPrompts.join(', ')}.`,
      sceneIds: missingVisualPrompts
    });
  }

  return {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    options,
    globalBible,
    clips,
    lint
  };
};
