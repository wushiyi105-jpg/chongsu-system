import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { capabilityClient } from '@lark-apaas/client-toolkit';
import { getDataloom } from '@lark-apaas/client-toolkit/dataloom';
import { getDefaultBucketId } from '@lark-apaas/client-toolkit/tools/storage';
import {
  Type,
  Link2,
  Mic,
  Image as ImageIcon,
  Camera,
  Square,
  ChevronDown,
  ChevronRight,
  X,
  Loader2,
  Sparkles,
  Plus,
} from 'lucide-react';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';

import { fragmentsApi, goalsApi, UnauthorizedError } from '@/api/index';
import {
  collectAllIdsFlat,
  insertGoalIntoTree,
  GoalTreeNode,
} from '@/components/GoalTagTreeSelect';
import CreateTagModal from '@/components/CreateTagModal';
import type {
  Goal,
  PillarKey,
  FragmentType,
  CreateFragmentRequest,
  ImageItem,
} from '@shared/api.interface';
import { Image } from '@client/src/components/ui/image';
import type { SpeechToTextRecordingConvertOneOutput } from '@shared/plugin-types';
import { getWebContainer, type WebContainer } from '@client/src/utils/web-container';

const PILLAR_INFO: Record<PillarKey, { name: string; color: string }> = {
  cognition: { name: '认知', color: '#2f66c9' },
  meaning: { name: '意义', color: '#e8a23a' },
  energy: { name: '能量', color: '#34a853' },
  relation: { name: '关系', color: '#d94a3d' },
  value: { name: '价值', color: '#1f3a8a' },
};

const CapturePage = () => {
  const navigate = useNavigate();

   // Tab state
   const [activeTab, setActiveTab] = useState<FragmentType>('text');

   // Text tab (now unified with images)
   const [textContent, setTextContent] = useState('');

  // Link tab
  const [url, setUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkSummary, setLinkSummary] = useState('');
  const [linkCover, setLinkCover] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseFailed, setParseFailed] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSource, setParseSource] = useState<string | null>(null);
  const [parseDataSource, setParseDataSource] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

   // Image (embedded in text tab)
   interface SelectedImage {
     id: string;
     file: File;
     compressedBlob?: Blob;
     url: string;
     width: number;
     height: number;
     size: number;
     uploadStatus: 'pending' | 'uploading' | 'done' | 'error';
     uploadUrl?: string;
     ocrStatus: 'pending' | 'processing' | 'done' | 'error';
     ocrText?: string;
     ocrMerged?: boolean;
   }
   const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
   const [ocrProcessing, setOcrProcessing] = useState(false);
   const [ocrCurrentIndex, setOcrCurrentIndex] = useState(0);
   const fileInputRef = useRef<HTMLInputElement>(null);
   const cameraInputRef = useRef<HTMLInputElement>(null);
   const MAX_IMAGES = 9;

  // Voice tab
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [voiceContent, setVoiceContent] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [recordingMode, setRecordingMode] = useState<'real' | 'mock' | null>(null);
  const [permissionState, setPermissionState] = useState<
    'unknown' | 'granted' | 'denied' | 'prompt' | 'unsupported' | 'insecure'
  >('unknown');
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [permissionHelpOpen, setPermissionHelpOpen] = useState(false);
  const [webContainer] = useState<WebContainer>(() => getWebContainer());
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const pcmSamplesRef = useRef<Float32Array | null>(null);
  const pcmLengthRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);
  const isRecordingRef = useRef(false);
  const isMockRecordingRef = useRef(false);

  // Goals / tag selector
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [expandedPillars, setExpandedPillars] = useState<Set<string>>(
    new Set(['cognition']),
  );
  const [tagSelectorOpen, setTagSelectorOpen] = useState(false);
  const [newTagPillar, setNewTagPillar] = useState<PillarKey | null>(null);
  const [creatingTag, setCreatingTag] = useState(false);
  const [createTagError, setCreateTagError] = useState<string | null>(null);

  // Save
  const [saving, setSaving] = useState(false);

  // Load goals
  useEffect(() => {
    let cancelled = false;
    const loadGoals = async () => {
      try {
        const data = await goalsApi.getGoals();
        if (!cancelled) {
          setGoals(data);
        }
      } catch (error) {
        logger.error('加载目标列表失败', error);
      } finally {
        if (!cancelled) setGoalsLoading(false);
      }
    };
    loadGoals();
    return () => {
      cancelled = true;
    };
  }, []);

  // Group goals by pillar (top-level goals only)
  const goalsByPillar = goals.reduce<Record<string, Goal[]>>((acc, goal) => {
    if (!goal.pillar) return acc;
    if (!acc[goal.pillar]) acc[goal.pillar] = [];
    acc[goal.pillar].push(goal);
    return acc;
  }, {});

  const collectFlatTags = (goalList: Goal[]): Goal[] => {
    const result: Goal[] = [];
    const walk = (list: Goal[]) => {
      for (const g of list) {
        result.push(g);
        if (g.children && g.children.length > 0) walk(g.children);
      }
    };
    walk(goalList);
    return result;
  };

  // All selected tag goals (for chip display)
  const selectedTags = useMemo(() => {
    return collectFlatTags(goals).filter((g) => selectedTagIds.includes(g.id));
  }, [goals, selectedTagIds]);

  const extractUrlFromText = (text: string): string | null => {
    const match = text.match(/https?:\/\/[^\s一-龥，。；,;！!？?"'`）)（【】《》]+/i);
    if (match) {
      return match[0].replace(/[.,;:!?，。；：！？、)]+$/i, '');
    }
    return null;
  };

  // --- Link parsing (debounced) ---
  const parseLink = useCallback(async (rawInput: string) => {
    if (!rawInput.trim()) return;
    setParsing(true);
    setParseFailed(false);
    setParseError(null);
    setParseSource(null);
    setParseDataSource(null);
    try {
      const result = await fragmentsApi.parseLink(rawInput);
      if (result.title) setLinkTitle(result.title);
      if (result.summary) setLinkSummary(result.summary);
      if (result.cover) setLinkCover(result.cover);
      if (result.source) setParseSource(result.source);
      if (result.dataSource) setParseDataSource(result.dataSource);
      if (result.error) setParseError(result.error);
      if (!result.title && !result.summary && !result.cover) {
        setParseFailed(true);
        if (result.error) setParseError(result.error);
      }
    } catch (error) {
      logger.error('解析链接失败', error);
      setParseFailed(true);
      setParseError('网络异常，解析请求失败');
    } finally {
      setParsing(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!url.trim()) return;
    const extracted = extractUrlFromText(url);
    if (!extracted) return;
    debounceRef.current = setTimeout(() => {
      parseLink(url);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [url, parseLink]);

  // --- Voice recording ---
  const startTimer = () => {
    durationRef.current = 0;
    setRecordDuration(0);
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setRecordDuration(durationRef.current);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const audioBlobToWav = async (
    blob: Blob,
    sampleRate = 16000,
    expectedDuration?: number,
  ): Promise<Blob> => {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioCtx();
    try {
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const originalDuration = audioBuffer.duration;
      const originalLength = audioBuffer.length;
      const numChannels = 1;

      const offlineCtx = new (window.OfflineAudioContext ||
        (window as any).webkitOfflineAudioContext)(
        numChannels,
        Math.ceil(originalDuration * sampleRate),
        sampleRate,
      );

      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);
      source.start(0);

      const renderedBuffer = await offlineCtx.startRendering();
      const length = renderedBuffer.length;
      const renderedDuration = renderedBuffer.duration;

      if (expectedDuration && expectedDuration > 2) {
        const ratio = renderedDuration / expectedDuration;
        if (ratio < 0.7) {
          logger.warn('WAV 转码时长偏差过大', {
            expectedDuration,
            renderedDuration,
            originalDuration,
            originalLength,
            ratio,
            blobSize: blob.size,
            blobType: blob.type,
          });
        }
      }

      const wavBuffer = new ArrayBuffer(44 + length * numChannels * 2);
      const view = new DataView(wavBuffer);

      const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
          view.setUint8(offset + i, str.charCodeAt(i));
        }
      };

      writeString(0, 'RIFF');
      view.setUint32(4, 36 + length * numChannels * 2, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * numChannels * 2, true);
      view.setUint16(32, numChannels * 2, true);
      view.setUint16(34, 16, true);
      writeString(36, 'data');
      view.setUint32(40, length * numChannels * 2, true);

      const channelData = renderedBuffer.getChannelData(0);
      let offset = 44;
      for (let i = 0; i < length; i++) {
        const s = Math.max(-1, Math.min(1, channelData[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }

      logger.info('WAV 转码完成', {
        originalDuration: originalDuration.toFixed(2),
        renderedDuration: renderedDuration.toFixed(2),
        sampleRate,
        blobSize: blob.size,
        wavSize: wavBuffer.byteLength,
      });

      return new Blob([wavBuffer], { type: 'audio/wav' });
    } finally {
      void audioContext.close();
    }
  };

  const float32ToWav = (samples: Float32Array, sampleRate: number): Blob => {
    const length = samples.length;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);

    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, length * 2, true);

    let offset = 44;
    for (let i = 0; i < length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  };

  const downsampleTo16k = (input: Float32Array, inputRate: number): Float32Array => {
    if (inputRate === 16000) return input.slice();
    const ratio = inputRate / 16000;
    const outputLength = Math.floor(input.length / ratio);
    const output = new Float32Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      const idx = i * ratio;
      const low = Math.floor(idx);
      const high = Math.min(low + 1, input.length - 1);
      const frac = idx - low;
      output[i] = input[low] * (1 - frac) + input[high] * frac;
    }
    return output;
  };

  const transcribeAudioFile = async (blob: Blob, durationSecs: number): Promise<string> => {
    let wavBlob: Blob = blob;
    const blobType = blob.type || '';
    if (!blobType.includes('wav')) {
      try {
        wavBlob = await audioBlobToWav(blob, 16000, durationSecs);
      } catch (convertErr) {
        logger.warn('WAV 转换失败，使用原始格式识别', convertErr);
      }
    }

    const file = new File([wavBlob], `voice_${Date.now()}.wav`, {
      type: wavBlob.type || 'audio/wav',
    });

    const result = await capabilityClient
      .load('speech_to_text_recording_convert_1')
      .call('speechToText', {
        audio_file: [file],
        language: 'zh',
      });

    const text = (result as { text?: string })?.text?.trim() || '';
    logger.info('ASR 插件转写完成', { length: text.length });
    return text;
  };

  const transcribeAudio = useCallback(async (blob: Blob, durationSecs: number) => {
    setTranscribing(true);
    setTranscribeError(null);
    const mins = Math.floor(durationSecs / 60);
    const secs = durationSecs % 60;
    const timeStr = mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;

    const setFailedText = (stage: string, reason: string, detail: string) => {
      const displayTip = detail ? `${stage}失败：${reason}（${detail}）` : `${stage}失败：${reason}`;
      setTranscribeError(displayTip);
      setVoiceContent(
        `[语音记录] 时长${timeStr}\n\n（${stage}失败：${reason}\n${detail ? detail + '\n' : ''}请手动编辑内容后保存）`,
      );
    };

    try {
      logger.info('开始转写音频', { duration: durationSecs, size: blob.size });
      const text = await transcribeAudioFile(blob, durationSecs);

      if (text.trim()) {
        setVoiceContent(`[语音记录] 时长${timeStr}\n\n${text.trim()}`);
        logger.info('语音转写成功', { duration: durationSecs, length: text.length });
      } else {
        setVoiceContent(
          `[语音记录] 时长${timeStr}\n\n（未识别到语音内容，请重新录制或手动编辑）`,
        );
        toast.warning('未识别到语音内容');
      }
    } catch (error) {
      logger.error('语音转写失败', error);
      const err = error as { message?: string; name?: string; code?: string | number };
      const errMsg = err?.message ?? '';
      const errName = err?.name ?? '';

      if (
        errName === 'NetworkError' ||
        errMsg.includes('network') ||
        errMsg.includes('Network') ||
        errMsg.includes('网络')
      ) {
        setFailedText('转写', '网络异常', '请检查网络连接后重试');
      } else if (errMsg.includes('timeout') || errMsg.includes('超时')) {
        setFailedText('转写', '超时', '音频较长或网络较慢，请稍后重试');
      } else if (
        errMsg.includes('401') ||
        errMsg.includes('unauthorized') ||
        errMsg.includes('未授权')
      ) {
        setFailedText('转写', '服务鉴权失败', '请刷新页面后重试');
      } else if (
        errMsg.includes('404') ||
        errMsg.includes('NotFound') ||
        errMsg.includes('not found')
      ) {
        setFailedText('转写', '服务暂不可用', '服务维护中，请稍后重试');
      } else if (errMsg.includes('format') || errMsg.includes('格式')) {
        setFailedText('转写', '音频格式不支持', '请换用其他浏览器或重新录制');
      } else if (errMsg) {
        const detail = errMsg.length > 80 ? errMsg.slice(0, 80) + '...' : errMsg;
        setFailedText('转写', '识别出错', detail);
      } else {
        setFailedText('转写', '未知错误', '请重试或手动编辑');
      }
    } finally {
      setTranscribing(false);
    }
  }, []);

  const releaseMediaStream = () => {
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      mediaStreamRef.current = null;
    }
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
    }
  };

  const finishRecording = useCallback(() => {
    stopTimer();
    setIsRecording(false);
    isRecordingRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      releaseMediaStream();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const pickAudioMimeType = (): string => {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
    ];
    for (const t of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return '';
  };

   const uploadAudio = async (blob: Blob): Promise<string | null> => {
     setAudioUploading(true);
     try {
       const fileName = `voice_${Date.now()}.webm`;
       const dataloom = await getDataloom();
       const file = new File([blob], fileName, { type: blob.type || 'audio/webm' });
       const { data, error } = await dataloom
         .storage
         .from(getDefaultBucketId())
         .uploadFile(file);
       if (error || !data) {
         const errMsg = typeof error === 'object' && error !== null
           ? (error as { message?: string }).message || JSON.stringify(error)
           : String(error ?? '未知错误');
         logger.warn('音频上传失败', errMsg);
         toast.error(`音频上传失败：${errMsg.slice(0, 40)}`);
         return null;
       }
       return data.download_url ?? null;
     } catch (err) {
       const errMsg = (err as { message?: string })?.message || String(err);
       logger.warn('音频上传异常', errMsg);
       toast.error(`音频上传失败：${errMsg.slice(0, 40)}`);
       return null;
     } finally {
       setAudioUploading(false);
     }
   };

   // --- Image compression ---
   const compressImage = async (file: File): Promise<{
     blob: Blob;
     width: number;
     height: number;
     size: number;
   }> => {
     const maxEdge = 2000;
     const targetSize = 1024 * 1024; // 1MB
     return new Promise((resolve, reject) => {
        const img = new window.Image();
       const objectUrl = URL.createObjectURL(file);
       img.onload = () => {
         try {
           let { width, height } = img;
           if (width > maxEdge || height > maxEdge) {
             if (width >= height) {
               height = Math.round((height / width) * maxEdge);
               width = maxEdge;
             } else {
               width = Math.round((width / height) * maxEdge);
               height = maxEdge;
             }
           }

           const canvas = document.createElement('canvas');
           canvas.width = width;
           canvas.height = height;
           const ctx = canvas.getContext('2d');
           if (!ctx) {
             URL.revokeObjectURL(objectUrl);
             reject(new Error('Canvas context not available'));
             return;
           }
           ctx.drawImage(img, 0, 0, width, height);

           let quality = 0.9;
           const compress = () => {
             canvas.toBlob(
               (blob) => {
                 if (!blob) {
                   URL.revokeObjectURL(objectUrl);
                   reject(new Error('压缩失败'));
                   return;
                 }
                 if (blob.size <= targetSize || quality <= 0.2) {
                   URL.revokeObjectURL(objectUrl);
                   resolve({
                     blob,
                     width,
                     height,
                     size: blob.size,
                   });
                 } else {
                   quality = Math.max(0.2, quality - 0.15);
                   compress();
                 }
               },
               'image/jpeg',
               quality,
             );
           };
           compress();
         } catch (err) {
           URL.revokeObjectURL(objectUrl);
           reject(err);
         }
       };
       img.onerror = () => {
         URL.revokeObjectURL(objectUrl);
         reject(new Error('图片加载失败'));
       };
       img.src = objectUrl;
     });
   };

   // --- Image upload ---
   const uploadImage = async (blob: Blob, fileName: string): Promise<string | null> => {
     try {
       const dataloom = await getDataloom();
       const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
       const { data, error } = await dataloom
         .storage
         .from(getDefaultBucketId())
         .uploadFile(file);
       if (error || !data) {
         const errMsg = typeof error === 'object' && error !== null
           ? (error as { message?: string }).message || JSON.stringify(error)
           : String(error ?? '未知错误');
         logger.warn('图片上传失败', errMsg);
         toast.error(`图片上传失败：${errMsg.slice(0, 40)}`);
         return null;
       }
       return data.download_url ?? null;
     } catch (err) {
       const errMsg = (err as { message?: string })?.message || String(err);
       logger.warn('图片上传异常', errMsg);
       toast.error(`图片上传失败：${errMsg.slice(0, 40)}`);
       return null;
     }
   };

   // --- Image file selection ---
   const handleImageFiles = useCallback(async (files: FileList | File[]) => {
     const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
     if (fileArray.length === 0) {
       toast.warning('未选择有效图片');
       return;
     }

     setSelectedImages((prev) => {
       const remaining = MAX_IMAGES - prev.length;
       if (remaining <= 0) {
         toast.warning(`最多只能上传 ${MAX_IMAGES} 张图片`);
         return prev;
       }
       if (fileArray.length > remaining) {
         toast.warning(`最多再添加 ${remaining} 张图片`);
       }
       return prev;
     });

     const currentCount = selectedImages.length;
     const remaining = MAX_IMAGES - currentCount;
     if (remaining <= 0) return;
     const filesToProcess = fileArray.slice(0, remaining);

     const newImages: SelectedImage[] = [];
     for (const file of filesToProcess) {
       try {
         const compressed = await compressImage(file);
         const url = URL.createObjectURL(compressed.blob);
         newImages.push({
           id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
           file,
           compressedBlob: compressed.blob,
           url,
           width: compressed.width,
           height: compressed.height,
           size: compressed.size,
           uploadStatus: 'pending',
           ocrStatus: 'pending',
         });
       } catch (err) {
         logger.warn('图片压缩失败', err);
         toast.error(`图片 ${file.name} 压缩失败`);
       }
     }

     if (newImages.length > 0) {
       setSelectedImages((prev) => [...prev, ...newImages]);
       void runOCR(newImages);
     }
   }, [selectedImages.length]);

    // --- Remove image ---
    const removeImage = useCallback((id: string) => {
      setSelectedImages((prev) => {
        const target = prev.find((img) => img.id === id);
        if (target) {
          try { URL.revokeObjectURL(target.url); } catch { /* ignore */ }
        }
        const next = prev.filter((img) => img.id !== id);
        return next;
      });
    }, []);

   // --- OCR ---
   const ocrOneImage = async (blob: Blob, fileName: string): Promise<string> => {
     const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });

     const streamResult = await capabilityClient
       .load('image_ocr_text_extraction_1')
       .callStream('imageUnderstanding', {
         upload_image: [file],
       });

      // Normalize stream: could be AsyncIterable directly or { output }
      const resultAny = streamResult as unknown as {
        output?: AsyncGenerator<{ content?: string }>;
      } | AsyncGenerator<{ content?: string }>;
      const stream =
        resultAny && typeof (resultAny as { output?: unknown }).output === 'object'
          ? (resultAny as { output: AsyncIterable<{ content?: string }> }).output
          : (resultAny as AsyncIterable<{ content?: string }>);

     let fullText = '';
     for await (const chunk of stream) {
       if (chunk?.content) {
         fullText += chunk.content;
       }
     }

     return fullText.trim();
   };

   const runOCR = useCallback(async (images?: SelectedImage[]) => {
     const targetImages = images ?? selectedImages;
     if (targetImages.length === 0) return;

     setOcrProcessing(true);

     for (let i = 0; i < targetImages.length; i++) {
       const img = targetImages[i];
       if (!img.compressedBlob) continue;
       if (img.ocrStatus === 'done') continue;

       // 更新当前图片为 processing
       setSelectedImages((prev) =>
         prev.map((item) =>
           item.id === img.id ? { ...item, ocrStatus: 'processing' } : item,
         ),
       );
       setOcrCurrentIndex(i + 1);

       try {
         const text = await ocrOneImage(img.compressedBlob, img.file.name);
         // 同时上传图片（不阻塞 OCR 进度展示，先设为 uploading 再后台传）
         setSelectedImages((prev) =>
           prev.map((item) =>
             item.id === img.id
               ? {
                   ...item,
                   ocrStatus: 'done',
                   ocrText: text,
                   uploadStatus: 'uploading',
                 }
               : item,
           ),
         );

         // 后台上传
         void uploadImage(img.compressedBlob, img.file.name).then((url) => {
           setSelectedImages((prev) =>
             prev.map((item) =>
               item.id === img.id
                 ? {
                     ...item,
                     uploadStatus: url ? 'done' : 'error',
                     uploadUrl: url ?? undefined,
                   }
                 : item,
             ),
           );
         });

         logger.info('图片 OCR 完成', { imageId: img.id, length: text.length });
       } catch (error) {
         logger.error('图片 OCR 失败', error);
         const err = error as { message?: string; name?: string; code?: string | number };
         const errMsg = err?.message ?? '';
         setSelectedImages((prev) =>
           prev.map((item) =>
             item.id === img.id ? { ...item, ocrStatus: 'error' } : item,
           ),
         );
         if (
           err.name === 'NetworkError' ||
           errMsg.includes('network') ||
           errMsg.includes('Network') ||
           errMsg.includes('网络')
         ) {
           toast.error('OCR 识别失败：网络异常');
         } else if (errMsg.includes('timeout') || errMsg.includes('超时')) {
           toast.error('OCR 识别失败：超时');
         } else if (
           errMsg.includes('401') ||
           errMsg.includes('unauthorized') ||
           errMsg.includes('未授权')
         ) {
           toast.error('OCR 服务鉴权失败');
         } else if (
           errMsg.includes('404') ||
           errMsg.includes('NotFound') ||
           errMsg.includes('not found')
         ) {
           toast.error('OCR 服务暂不可用');
         } else {
           const detail = errMsg?.length > 40 ? errMsg.slice(0, 40) + '...' : errMsg || '未知错误';
           toast.error(`OCR 识别失败：${detail}`);
         }
       }
     }

      // 全部完成后，把OCR结果合并到正文末尾
      setSelectedImages((prev) => {
        const newBlocks: string[] = [];
        prev.forEach((item, idx) => {
          if (!item.ocrMerged && item.ocrStatus === 'done' && item.ocrText?.trim()) {
            newBlocks.push(`[图片${idx + 1}]\n${item.ocrText.trim()}`);
          }
        });
        if (newBlocks.length > 0) {
          setTextContent((prevText) => {
            const prefix = prevText && prevText.trim() ? prevText.trim() + '\n\n' : '';
            return prefix + newBlocks.join('\n\n');
          });
        }
        // 标记已合并
        return prev.map((item) =>
          item.ocrStatus === 'done' && !item.ocrMerged
            ? { ...item, ocrMerged: true }
            : item,
        );
      });

      setOcrProcessing(false);
    }, [selectedImages]);

  const startRecording = async () => {
    if (isRecordingRef.current) return;
    isRecordingRef.current = true;
    isMockRecordingRef.current = false;
    setIsRecording(true);
    setVoiceContent('');
    setTranscribing(false);
    setTranscribeError(null);
    setAudioBlob(null);
    setAudioUrl(null);
    audioChunksRef.current = [];

    const hasMedia =
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof MediaRecorder !== 'undefined';

     const isSecure =
       typeof window !== 'undefined' &&
       (window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost');

     const isInIframe = webContainer === 'iframe';
     const isCapacitor = webContainer === 'capacitor';

     if (!isSecure) {
       isRecordingRef.current = false;
       setIsRecording(false);
       setPermissionState('insecure');
       setPermissionError('当前页面非安全上下文，麦克风不可用');
       setPermissionHelpOpen(true);
       setRecordingMode(null);
       toast.error('非安全上下文，无法使用麦克风');
       return;
     }

     if (!hasMedia) {
       isRecordingRef.current = false;
       setIsRecording(false);
       setPermissionState('unsupported');
       setPermissionError('当前浏览器不支持录音功能');
       setPermissionHelpOpen(true);
       setRecordingMode(null);
       toast.info('当前浏览器不支持录音');
       return;
     }

     try {
       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
       setPermissionState('granted');
       setPermissionError(null);
       setPermissionHelpOpen(false);
      if (!isRecordingRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const mimeType = pickAudioMimeType();
       mediaStreamRef.current = stream;
       const mediaRecorder = mimeType
         ? new MediaRecorder(stream, { mimeType })
         : new MediaRecorder(stream);
       mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const sourceNode = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = sourceNode;
      const scriptNode = audioCtx.createScriptProcessor(4096, 1, 1);
      scriptNodeRef.current = scriptNode;
      pcmSamplesRef.current = new Float32Array(Math.ceil(audioCtx.sampleRate * 600));
      pcmLengthRef.current = 0;

      scriptNode.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!isRecordingRef.current) return;
        const input = e.inputBuffer.getChannelData(0);
        const samples = pcmSamplesRef.current!;
        const len = pcmLengthRef.current;
        if (len + input.length > samples.length) {
          const newSize = samples.length * 2;
          const newSamples = new Float32Array(newSize);
          newSamples.set(samples);
          pcmSamplesRef.current = newSamples;
        }
        pcmSamplesRef.current!.set(input, len);
        pcmLengthRef.current = len + input.length;
      };

      sourceNode.connect(scriptNode);
      scriptNode.connect(audioCtx.destination);

      setRecordingMode('real');
      startTimer();

      mediaRecorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

       mediaRecorder.onstop = () => {
         stream.getTracks().forEach((t) => t.stop());
         const chunks = audioChunksRef.current;
         const dur = durationRef.current;
         const inputSampleRate = audioCtx.sampleRate;
         const pcmLen = pcmLengthRef.current;
         const totalSize = chunks.reduce((sum: number, c: Blob) => sum + c.size, 0);
         logger.info('录音停止', {
           chunkCount: chunks.length,
           totalSize,
           duration: dur,
           mimeType: mediaRecorder.mimeType,
           inputSampleRate,
           pcmSamples: pcmLen,
           pcmDuration: pcmLen / inputSampleRate,
         });

         let pcm16k: Float32Array | null = null;
         if (pcmLen > 0) {
           try {
             const rawPcm = pcmSamplesRef.current!.slice(0, pcmLen);
             pcm16k = downsampleTo16k(rawPcm, inputSampleRate);
             const pcmDuration = pcm16k.length / 16000;
             logger.info('PCM 降采样完成', {
               inputRate: inputSampleRate,
               outputRate: 16000,
               inputSamples: pcmLen,
               outputSamples: pcm16k.length,
               pcmDuration: pcmDuration.toFixed(2),
               timerDuration: dur,
             });
           } catch (pcmErr) {
             logger.warn('PCM 降采样失败，降级使用 MediaRecorder 转码', pcmErr);
           }
         }

         const cleanup = () => {
           try { scriptNode.disconnect(); } catch { /* ignore */ }
           try { sourceNode.disconnect(); } catch { /* ignore */ }
           void audioCtx.close();
           mediaStreamRef.current = null;
           mediaRecorderRef.current = null;
           audioCtxRef.current = null;
           sourceNodeRef.current = null;
           scriptNodeRef.current = null;
           pcmSamplesRef.current = null;
           pcmLengthRef.current = 0;
         };

         finishRecording();

         if ((chunks.length === 0 || totalSize === 0) && !pcm16k) {
           cleanup();
           setVoiceContent('[语音记录] 录音数据为空，请重新录制');
           setTranscribeError('录音数据为空');
           toast.error('录音数据为空，请重新录制');
           return;
         }

         let playbackBlob: Blob | null = null;
         if (chunks.length > 0 && totalSize > 0) {
           playbackBlob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
           setAudioBlob(playbackBlob);
           void uploadAudio(playbackBlob).then((u) => {
             if (u) setAudioUrl(u);
           });
         }

         if (pcm16k && pcm16k.length > 1600) {
           const wavBlob = float32ToWav(pcm16k, 16000);
           const pcmDur = pcm16k.length / 16000;
           logger.info('使用 PCM 直采 WAV 转写', {
             wavSize: wavBlob.size,
             pcmDuration: pcmDur.toFixed(2),
           });
           void transcribeAudio(wavBlob, pcmDur);
         } else if (playbackBlob) {
           logger.warn('PCM 数据不足，降级使用 MediaRecorder 数据转码');
           void transcribeAudio(playbackBlob, dur);
         } else {
           setVoiceContent('[语音记录] 录音数据为空，请重新录制');
           setTranscribeError('录音数据为空');
           toast.error('录音数据为空，请重新录制');
         }

         cleanup();
       };

      mediaRecorder.start(1000);
     } catch (error) {
       if (!isRecordingRef.current) return;
       finishRecording();
       const msg = (error as { message?: string; name?: string })?.message ?? '';
       const name = (error as { name?: string })?.name ?? '';
       logger.warn('麦克风不可用', msg);

       let reason = '麦克风权限未开启';
       let state: typeof permissionState = 'denied';

       if (name === 'NotAllowedError' || msg.includes('Permission') || msg.includes('denied')) {
         reason = '麦克风权限被拒绝';
         state = 'denied';
       } else if (name === 'NotFoundError' || msg.includes('device')) {
         reason = '未检测到麦克风设备';
         state = 'unsupported';
       } else if (name === 'NotReadableError') {
         reason = '麦克风被其他应用占用';
         state = 'denied';
        } else if (name === 'SecurityError' || isInIframe) {
          reason = '当前在预览容器内，麦克风被限制';
          state = 'denied';
        }

       setPermissionState(state);
       setPermissionError(reason);
       setPermissionHelpOpen(true);
       setRecordingMode(null);

       toast.error(reason);
     }
  };

  const stopRecording = () => {
    if (!isRecordingRef.current) return;
    if (
      mediaRecorderRef.current &&
      recordingMode === 'real' &&
      !isMockRecordingRef.current
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        finishRecording();
      }
    } else {
      const dur = durationRef.current;
      const mins = Math.floor(dur / 60);
      const secs = dur % 60;
      const timeStr = mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;
      finishRecording();
      if (isMockRecordingRef.current) {
        setVoiceContent(
          `[语音记录（模拟模式）] 时长${timeStr}\n\n当前为模拟模式（麦克风权限未开启），此处内容为占位文本，可编辑后保存。`,
        );
        isMockRecordingRef.current = false;
      }
    }
  };

  const toggleRecording = () => {
    if (isRecordingRef.current) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (mediaRecorderRef.current) {
        try {
          mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
        } catch {
          // ignore
        }
      }
      if (scriptNodeRef.current) {
        try { scriptNodeRef.current.disconnect(); } catch { /* ignore */ }
      }
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.disconnect(); } catch { /* ignore */ }
      }
      if (audioCtxRef.current) {
        void audioCtxRef.current.close();
      }
      audioChunksRef.current = [];
      pcmSamplesRef.current = null;
      pcmLengthRef.current = 0;
    };
  }, []);

  // --- Tag selection ---
  const collectAllGoalIds = (goalList: Goal[]): string[] => {
    return collectAllIdsFlat(goalList);
  };

  const getAllGoalIdsUnderPillar = (pillarKey: PillarKey): string[] => {
    const pillarGoals = goalsByPillar[pillarKey] || [];
    return collectAllGoalIds(pillarGoals);
  };

  const toggleTag = (goalId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(goalId)
        ? prev.filter((id) => id !== goalId)
        : [...prev, goalId],
    );
  };

  const removeTag = (goalId: string) => {
    setSelectedTagIds((prev) => prev.filter((id) => id !== goalId));
  };

  const isPillarAllSelected = (pillarKey: PillarKey): boolean => {
    const ids = getAllGoalIdsUnderPillar(pillarKey);
    if (ids.length === 0) return false;
    return ids.every((id) => selectedTagIds.includes(id));
  };

  const isPillarPartialSelected = (pillarKey: PillarKey): boolean => {
    const ids = getAllGoalIdsUnderPillar(pillarKey);
    if (ids.length === 0) return false;
    const selectedCount = ids.filter((id) => selectedTagIds.includes(id)).length;
    return selectedCount > 0 && selectedCount < ids.length;
  };

  const togglePillarAll = (pillarKey: PillarKey, checked: boolean) => {
    const ids = getAllGoalIdsUnderPillar(pillarKey);
    if (ids.length === 0) return;
    setSelectedTagIds((prev) => {
      if (checked) {
        const set = new Set(prev);
        ids.forEach((id) => set.add(id));
        return Array.from(set);
      } else {
        const set = new Set(prev);
        ids.forEach((id) => set.delete(id));
        return Array.from(set);
      }
    });
  };

  const togglePillarExpand = (pillar: string) => {
    setExpandedPillars((prev) => {
      const next = new Set(prev);
      if (next.has(pillar)) next.delete(pillar);
      else next.add(pillar);
      return next;
    });
  };

  const getPillarSelectedCount = (pillarKey: PillarKey): number => {
    const ids = getAllGoalIdsUnderPillar(pillarKey);
    return ids.filter((id) => selectedTagIds.includes(id)).length;
  };

  const tagScrollRef = useRef<HTMLDivElement>(null);

  const confirmCreateTag = async (name: string): Promise<void> => {
    if (!newTagPillar) return;
    const pillarGoals = goalsByPillar[newTagPillar] || [];
    const exists = pillarGoals.some((g: Goal) => g.name === name);
    if (exists) {
      setCreateTagError('该支柱下已有同名标签');
      throw new Error('duplicate name');
    }
    setCreateTagError(null);
    setCreatingTag(true);
    try {
      const newGoal: Goal = await goalsApi.createGoal({
        name,
        pillar: newTagPillar,
      });
      setGoals((prev) => insertGoalIntoTree(prev, null, newGoal));
      setSelectedTagIds((prev) => [...prev, newGoal.id]);
      setNewTagPillar(null);
      toast.success('标签已创建');
    } catch (error) {
      logger.error('创建标签失败', error);
      if (error instanceof UnauthorizedError) {
        setCreateTagError('创建失败(401)：请重新登录');
      } else {
        const code = (error as { statusCode?: number })?.statusCode || 0;
        const msg = code ? `创建失败(${code})，请重试` : '创建失败，请重试';
        setCreateTagError(msg);
      }
      throw error;
    } finally {
      setCreatingTag(false);
    }
  };

  const handleSubTagCreated = (parentId: string, newGoal: Goal): void => {
    setGoals((prev) => insertGoalIntoTree(prev, parentId, newGoal));
    setSelectedTagIds((prev) => [...prev, newGoal.id]);
  };

  // --- Save ---
   const canSave = () => {
     if (activeTab === 'text') {
       const hasText = textContent.trim().length > 0;
       const hasImages = selectedImages.length > 0;
       return hasText || hasImages;
     }
     if (activeTab === 'link') return url.trim().length > 0;
     if (activeTab === 'voice') return voiceContent.trim().length > 0;
     return false;
   };

  const handleSave = async () => {
    if (!canSave() || saving) return;

    const req: CreateFragmentRequest = {
      type: activeTab,
      tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    };

     if (activeTab === 'text') {
       req.content = textContent.trim() || null;
       if (selectedImages.length > 0) {
         req.images = selectedImages
           .filter((img) => img.uploadStatus === 'done' && img.uploadUrl)
           .map((img) => ({
             url: img.uploadUrl!,
             width: img.width,
             height: img.height,
             size: img.size,
           }));
       }
     } else if (activeTab === 'link') {
      req.rawUrl = url.trim();
      req.title = linkTitle.trim() || null;
      req.summary = linkSummary.trim() || null;
      req.cover = linkCover;
      req.content = linkSummary.trim() || linkTitle.trim() || url.trim();
     } else if (activeTab === 'voice') {
       req.content = voiceContent.trim();
       req.audioUrl = audioUrl ?? null;
     }

    setSaving(true);
    try {
      const fragment = await fragmentsApi.createFragment(req);
      logger.info('碎片保存成功', fragment.id);
      toast.success('碎片已保存');
      navigate('/fragments');
    } catch (error) {
      logger.error('碎片保存失败', error);
      toast.error('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex flex-col min-h-full pb-32">
      {/* 标题 */}
      <div className="mb-6 pt-1">
        <p className="text-[11px] uppercase tracking-widest text-text-tertiary mb-1.5 font-medium">
          NEW FRAGMENT
        </p>
        <h2 className="text-[22px] font-semibold text-primary tracking-tight leading-tight">记录碎片</h2>
        <p className="text-[12px] text-text-secondary mt-1">
          把此刻的灵感沉淀下来
        </p>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as FragmentType)}
        className="w-full"
      >
          <TabsList className="grid w-full grid-cols-3 bg-surface-muted p-1 rounded-xl h-auto border border-border">
            <TabsTrigger
              value="text"
              className="gap-1.5 h-8 rounded-lg data-[state=active]:bg-surface data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-sm text-text-secondary text-[13px] transition-colors"
            >
              <Type size={14} />
              记录
            </TabsTrigger>
          <TabsTrigger
            value="link"
            className="gap-1.5 h-8 rounded-lg data-[state=active]:bg-surface data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-sm text-text-secondary text-[13px] transition-colors"
          >
            <Link2 size={14} />
            链接
          </TabsTrigger>
          <TabsTrigger
            value="voice"
            className="gap-1.5 h-8 rounded-lg data-[state=active]:bg-surface data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-sm text-text-secondary text-[13px] transition-colors"
          >
             <Mic size={14} />
             语音
           </TabsTrigger>
         </TabsList>

        {/* 记录 Tab（文字+图片合一） */}
        <TabsContent value="text" className="mt-5 space-y-4">
          <div>
            <label className="text-[12px] text-text-secondary font-medium mb-2 block">正文</label>
            <Textarea
              placeholder="记录你的想法、灵感、学习笔记..."
              className="min-h-[180px] resize-none text-[13px] text-primary bg-surface border border-border rounded-2xl p-4 placeholder:text-text-tertiary focus-visible:ring-primary focus-visible:ring-1 shadow-sm"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
            />
            <div className="mt-1.5 text-right text-[12px] text-text-tertiary">
              <span className="num-tnum">{textContent.length}</span> 字
            </div>
          </div>

          {/* 图片区 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] text-text-secondary font-medium">
                图片
                <span className="ml-1 text-text-tertiary font-normal">
                  （{selectedImages.length}/{MAX_IMAGES}，可OCR识别后合并到正文）
                </span>
              </label>
              {ocrProcessing && (
                <span className="text-[12px] text-text-secondary flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" />
                  识别中 {ocrCurrentIndex}/{selectedImages.length}
                </span>
              )}
            </div>

            {/* 图片预览网格 */}
            {selectedImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {selectedImages.map((img, index) => (
                  <div
                    key={img.id}
                    className="relative aspect-square rounded-xl overflow-hidden bg-surface border border-border shadow-sm group"
                  >
                    <Image
                      src={img.url}
                      alt={`图片${index + 1}`}
                      className="w-full h-full object-cover"
                      width={200}
                      height={200}
                    />
                    <button
                      onClick={() => removeImage(img.id)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="删除图片"
                    >
                      <X size={12} />
                    </button>
                    <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
                      <span className="text-[10px] text-white/90 bg-black/40 px-1.5 py-0.5 rounded-md">
                        图片{index + 1}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md">
                        {img.ocrStatus === 'processing' && (
                          <span className="flex items-center gap-1 text-white bg-black/40">
                            <Loader2 size={10} className="animate-spin" />
                            识别中
                          </span>
                        )}
                        {img.ocrStatus === 'done' && (
                          <span className="text-white bg-active-fg/80">已识别</span>
                        )}
                        {img.ocrStatus === 'error' && (
                          <span className="text-white bg-danger-fg/80">识别失败</span>
                        )}
                        {img.ocrStatus === 'pending' && (
                          <span className="text-white/70 bg-black/30">等待中</span>
                        )}
                      </span>
                    </div>
                    {img.uploadStatus === 'uploading' && (
                      <div className="absolute top-1 left-1">
                        <Loader2 size={12} className="text-white/80 animate-spin" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 添加图片按钮 */}
            {selectedImages.length < MAX_IMAGES && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={ocrProcessing}
                  className="h-11 rounded-xl bg-surface text-primary border border-border-strong hover:bg-surface-muted text-[13px] font-medium gap-2"
                >
                  <Plus size={16} />
                  从相册
                </Button>
                <Button
                  variant="outline"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={ocrProcessing}
                  className="h-11 rounded-xl bg-surface text-primary border border-border-strong hover:bg-surface-muted text-[13px] font-medium gap-2"
                >
                  <Camera size={16} />
                  拍照
                </Button>
              </div>
            )}

            {/* 隐藏的文件 input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  void handleImageFiles(e.target.files);
                }
                e.target.value = '';
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  void handleImageFiles(e.target.files);
                }
                e.target.value = '';
              }}
            />
          </div>
        </TabsContent>

        {/* 链接 Tab */}
        <TabsContent value="link" className="mt-5 space-y-4">
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="粘贴链接地址..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 h-9 text-[13px] bg-surface border border-border rounded-lg px-3 placeholder:text-text-tertiary text-primary focus-visible:ring-primary focus-visible:ring-1"
            />
            <Button
              variant="outline"
              onClick={() => parseLink(url)}
              disabled={parsing || !url.trim()}
              className="h-9 px-4 rounded-lg bg-surface text-primary border border-border-strong hover:bg-surface-muted text-[13px] font-medium"
            >
              {parsing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              抓取
            </Button>
          </div>

          {parseFailed && (
            <div className="text-[12px] text-danger-fg bg-danger-bg px-3 py-2 rounded-lg border border-danger-bg">
              {parseError || '抓取失败，请手动填写'}
            </div>
          )}

          {!parseFailed && parseError && (linkTitle || linkSummary) && (
            <div className="text-[12px] text-pending-fg bg-pending-bg px-3 py-2 rounded-lg border border-pending-bg flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-pending-fg" />
              {parseError}
            </div>
          )}

          {(linkTitle || linkSummary || linkCover || parseFailed) && (
            <div className="space-y-4 rounded-2xl bg-surface-muted shadow-sm p-4 border border-border">
              {parseDataSource && (
                <div className="text-[12px] text-text-secondary flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        parseSource === 'tikhub' ? '#6d4aff' : 'var(--feature-fg, #2f66c9)',
                    }}
                  />
                  {parseDataSource}
                </div>
              )}
              {linkCover && (
                <div className="rounded-xl overflow-hidden aspect-video bg-surface border border-border">
                  <Image
                    src={linkCover}
                    alt="封面"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-[12px] text-text-secondary font-medium">标题</label>
                <Input
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="链接标题"
                  className="h-9 bg-surface border border-border rounded-lg px-3 text-[13px] text-primary placeholder:text-text-tertiary focus-visible:ring-primary focus-visible:ring-1"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] text-text-secondary font-medium">摘要</label>
                <Textarea
                  value={linkSummary}
                  onChange={(e) => setLinkSummary(e.target.value)}
                  placeholder="链接摘要"
                  className="min-h-[80px] resize-none bg-surface border border-border rounded-lg p-3 text-[13px] text-primary placeholder:text-text-tertiary focus-visible:ring-primary focus-visible:ring-1"
                />
              </div>
            </div>
          )}
        </TabsContent>

        {/* 语音 Tab */}
        <TabsContent value="voice" className="mt-5">
          <div className="flex flex-col items-center py-8 bg-surface-muted rounded-2xl shadow-sm border border-border">
              <button
                onClick={toggleRecording}
                disabled={transcribing}
                className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm ${
                  transcribing
                    ? 'bg-surface text-primary cursor-wait border-2 border-border'
                    : isRecording
                    ? 'bg-danger text-danger-foreground'
                    : 'bg-surface text-primary border-2 border-border hover:bg-surface-muted'
                } disabled:opacity-70`}
              >
                {isRecording && (
                  <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30" />
                )}
                {transcribing ? (
                  <Loader2 size={24} className="relative z-10 animate-spin" />
                ) : isRecording ? (
                  <Square size={24} fill="currentColor" className="relative z-10" />
                ) : (
                  <Mic size={26} className="relative z-10" />
                )}
              </button>

              <div className="mt-4 text-2xl font-semibold num-tnum text-primary font-mono">
                {formatDuration(recordDuration)}
              </div>
              <div className="text-[12px] text-text-secondary mt-1">
                {transcribing
                  ? '转写中，请稍候...'
                  : isRecording
                  ? recordingMode === 'mock'
                    ? '模拟录音中，点击停止'
                    : '正在录音，点击停止'
                  : '点击开始录音'}
              </div>
               {recordingMode === 'mock' && !permissionHelpOpen && (
                 <div className="text-[11px] text-text-secondary mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-surface rounded-full border border-border">
                   <span className="w-1.5 h-1.5 rounded-full bg-pending-fg" />
                   模拟模式（麦克风未授权），非真实转写
                 </div>
               )}
               {permissionHelpOpen && permissionError && (
                 <div className="mt-4 mx-5 w-full px-5">
                   <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
                     <div className="flex items-start gap-2">
                       <span className="w-2 h-2 rounded-full bg-pending-fg mt-1.5 flex-shrink-0" />
                       <div className="text-[12px] text-text-secondary leading-relaxed">
                         <div className="font-semibold text-primary mb-1">{permissionError}</div>
                         {permissionState === 'insecure' && (
                           <div>麦克风需要 HTTPS 安全环境。请使用发布链接独立打开本应用。</div>
                         )}
                          {permissionState === 'denied' && (
                            <div className="space-y-2">
                              {webContainer === 'capacitor' ? (
                                <>
                                  <div>麦克风权限未开启，请按以下步骤操作：</div>
                                  <ol className="list-decimal list-inside space-y-0.5 pl-1">
                                    <li>打开手机「设置」→「应用」→「重塑系统」</li>
                                    <li>进入「权限」→「麦克风」</li>
                                    <li>选择「仅使用期间允许」或「始终允许」</li>
                                    <li>返回应用后，点击下方『重新请求权限』重试</li>
                                  </ol>
                                </>
                              ) : webContainer === 'iframe' ? (
                                <>
                                  <div>当前在预览窗口内打开，麦克风被容器限制。</div>
                                  <div>请复制发布链接在新标签页独立打开后测试语音功能。</div>
                                </>
                              ) : (
                                <>
                                  <div>你之前拒绝过麦克风权限，请按以下步骤开启：</div>
                                  <ol className="list-decimal list-inside space-y-0.5 pl-1">
                                    <li>点击浏览器地址栏左侧的 🔒 锁图标</li>
                                    <li>找到「麦克风」→ 选择「允许」</li>
                                    <li>刷新页面后重新点击录音</li>
                                  </ol>
                                  <div className="text-[11px] text-text-tertiary pt-1">
                                    提示：如果当前在预览窗口内打开，麦克风会被容器限制。
                                    请复制发布链接在新标签页独立打开后测试语音功能。
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                         {permissionState === 'unsupported' && (
                           <div>当前浏览器或设备不支持录音，请换用 Chrome / Safari / Edge 等现代浏览器。</div>
                         )}
                       </div>
                     </div>
                     <div className="flex gap-2">
                       <button
                         onClick={() => {
                           setPermissionHelpOpen(false);
                           setPermissionError(null);
                           void startRecording();
                         }}
                         className="flex-1 h-9 text-[12px] font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors"
                       >
                         重新请求权限
                       </button>
                       <button
                         onClick={() => {
                           setPermissionHelpOpen(false);
                           setPermissionError(null);
                           setRecordingMode('mock');
                           isMockRecordingRef.current = true;
                           isRecordingRef.current = true;
                           setIsRecording(true);
                           setVoiceContent('');
                           setTranscribeError(null);
                           setAudioBlob(null);
                           setAudioUrl(null);
                           audioChunksRef.current = [];
                           startTimer();
                         }}
                         className="flex-1 h-9 text-[12px] font-medium bg-surface text-primary border border-border rounded-lg hover:bg-surface-muted transition-colors"
                       >
                         继续模拟模式
                       </button>
                     </div>
                   </div>
                 </div>
               )}
              {transcribeError && recordingMode === 'real' && (
                <div className="text-[11px] text-danger-fg mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-surface rounded-full border border-border">
                  <span className="w-1.5 h-1.5 rounded-full bg-danger-fg" />
                  {transcribeError}
                </div>
              )}
              {audioUrl && recordingMode === 'real' && (
                <div className="mt-4 w-full px-5">
                  <label className="text-[11px] text-text-tertiary mb-1.5 block font-medium uppercase tracking-wide">原始录音</label>
                  <audio controls src={audioUrl} className="w-full h-8" />
                </div>
              )}
              {audioUploading && (
                <div className="text-[11px] text-text-tertiary mt-2 flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" />
                  音频上传中...
                </div>
              )}
          </div>

           {(voiceContent || transcribing) && (
             <div className="mt-4 space-y-2">
               <label className="text-[12px] text-text-secondary font-medium flex items-center gap-1.5">
                 {transcribing && (
                   <Loader2 size={12} className="animate-spin" />
                 )}
                 {transcribing ? '转写中...' : '转写内容（可编辑）'}
               </label>
               <Textarea
                 value={voiceContent}
                 onChange={(e) => setVoiceContent(e.target.value)}
                 disabled={transcribing}
                 placeholder={transcribing ? '正在识别语音内容...' : undefined}
                 className="min-h-[120px] resize-none bg-surface border border-border rounded-2xl p-4 text-[13px] text-primary placeholder:text-text-tertiary focus-visible:ring-primary focus-visible:ring-1 shadow-sm"
               />
             </div>
           )}
         </TabsContent>
       </Tabs>

      {/* 选中的标签 chips */}
      {selectedTags.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-muted text-primary border border-border text-[12px] font-medium"
            >
              {tag.name}
              <button
                onClick={() => removeTag(tag.id)}
                className="ml-0.5 hover:opacity-70 text-text-secondary"
              >
                <X size={12} />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* 标签选择器 */}
      <div className="mt-5">
        <button
          onClick={() => setTagSelectorOpen(!tagSelectorOpen)}
          className="w-full flex items-center justify-between py-3 text-[13px] font-semibold text-primary"
        >
          <span>
            关联标签
            {selectedTags.length > 0 && (
              <span className="ml-2 text-active-fg text-[12px] font-medium">
                已选 <span className="num-tnum">{selectedTags.length}</span> 个
              </span>
            )}
          </span>
          {tagSelectorOpen ? (
            <ChevronDown size={16} className="text-text-tertiary" />
          ) : (
            <ChevronRight size={16} className="text-text-tertiary" />
          )}
        </button>

        {tagSelectorOpen && (
          <div ref={tagScrollRef} className="rounded-2xl bg-surface-muted shadow-sm p-3 border border-border space-y-1 max-h-[360px] overflow-y-auto">
            {goalsLoading ? (
                <div className="py-6 text-center text-[13px] text-text-tertiary">
                 <Loader2 size={20} className="animate-spin mx-auto mb-2" />
                 加载标签中...
               </div>
              ) : (
                (Object.keys(PILLAR_INFO) as PillarKey[]).map((pillarKey) => {
                  const pillarGoals = goalsByPillar[pillarKey] || [];
                  const pillarInfo = PILLAR_INFO[pillarKey];
                  const isExpanded = expandedPillars.has(pillarKey);
                  const allSelected = isPillarAllSelected(pillarKey);
                  const partialSelected = isPillarPartialSelected(pillarKey);
                  const selectedCount = getPillarSelectedCount(pillarKey);
                  const hasGoals = pillarGoals.length > 0;

                  const handlePillarCheck = () => {
                    if (!hasGoals) return;
                    togglePillarAll(pillarKey, !allSelected);
                  };

                  return (
                    <Collapsible
                      key={pillarKey}
                      open={isExpanded}
                      onOpenChange={() => togglePillarExpand(pillarKey)}
                    >
                       <div
                         className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg hover:bg-surface cursor-pointer transition-colors"
                         onClick={() => togglePillarExpand(pillarKey)}
                       >
                         <div className="flex items-center justify-center w-5 h-5 flex-shrink-0 pointer-events-none">
                           {isExpanded ? (
                             <ChevronDown size={14} className="text-text-tertiary" />
                           ) : (
                             <ChevronRight size={14} className="text-text-tertiary" />
                           )}
                         </div>
                         <div onClick={(e) => e.stopPropagation()}>
                           <Checkbox
                             id={`pillar-${pillarKey}`}
                             checked={allSelected ? true : partialSelected ? 'indeterminate' : false}
                             disabled={!hasGoals}
                             onCheckedChange={handlePillarCheck}
                             className="data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary"
                           />
                         </div>
                         <span
                           className="w-2.5 h-2.5 rounded-full flex-shrink-0 pointer-events-none"
                           style={{ backgroundColor: pillarInfo.color }}
                         />
                         <label
                           htmlFor={`pillar-${pillarKey}`}
                           className={`font-medium text-[13px] flex-1 cursor-pointer truncate ${!hasGoals ? 'text-text-tertiary' : 'text-primary'}`}
                           onClick={(e) => e.stopPropagation()}
                         >
                           {pillarInfo.name}
                         </label>
                         <span className="text-[12px] text-text-tertiary flex-shrink-0 flex items-center gap-1 pointer-events-none">
                           {hasGoals ? (
                             <>
                               <span className="num-tnum">{selectedCount}</span>
                               <span className="text-border">/</span>
                               <span className="num-tnum">{getAllGoalIdsUnderPillar(pillarKey).length}</span>
                             </>
                           ) : (
                             <span>暂无标签</span>
                           )}
                         </span>
                       </div>
                      <CollapsibleContent className="space-y-1 pl-10 pr-2 pb-2">
                          {pillarGoals.length === 0 && (
                            <div className="py-2 text-[12px] text-text-tertiary">
                              该支柱下暂无标签，点击下方按钮新建
                            </div>
                          )}
                          {pillarGoals.map((goal) => (
                            <GoalTreeNode
                              key={goal.id}
                              goal={goal}
                              selectedIds={selectedTagIds}
                              onToggle={toggleTag}
                              onSubTagCreated={handleSubTagCreated}
                              pillar={pillarKey}
                            />
                          ))}
                          <button
                            type="button"
                            onClick={() => setNewTagPillar(pillarKey)}
                            className="w-full flex items-center justify-center gap-1.5 py-2 mt-1.5 text-[12px] text-text-secondary hover:text-primary hover:bg-surface rounded-lg transition-colors border border-dashed border-border touch-manipulation"
                          >
                            <Plus size={14} />
                            新建标签
                          </button>
                       </CollapsibleContent>
                    </Collapsible>
                  );
                })
              )}
           </div>
        )}
       </div>

      <CreateTagModal
        open={newTagPillar !== null}
        onOpenChange={(open) => {
          if (!open) {
            setNewTagPillar(null);
            setCreateTagError(null);
          }
        }}
        title={`新建${newTagPillar ? PILLAR_INFO[newTagPillar].name : ''}标签`}
        loading={creatingTag}
        error={createTagError}
        onCreate={confirmCreateTag}
      />

       {/* 底部保存按钮 */}
       <div className="fixed bottom-[60px] left-1/2 -translate-x-1/2 w-full max-w-[480px] px-4 py-3 bg-gradient-to-t from-canvas via-canvas/95 to-transparent z-10">
          <Button
            onClick={handleSave}
            disabled={!canSave() || saving}
            className="w-full h-10 text-[14px] font-semibold bg-primary text-primary-foreground shadow-sm rounded-lg hover:bg-primary/90 active:bg-primary/80 disabled:bg-surface-muted disabled:text-text-tertiary transition-colors"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              '保存'
            )}
          </Button>
       </div>
    </div>
  );
};

export default CapturePage;
