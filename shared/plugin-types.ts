// ---- plugin:speech_to_text_recording_convert_1 ----
// ============================================================
// 插件 speech_to_text_recording_convert_1 (用户录音音频转文字) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface SpeechToTextRecordingConvertOneInput {
  /** 待识别的音频文件，支持wav、mp3、ogg格式 */
  audio_file: string[];
  /** 音频识别的语言，可选值：zh(中文)、en(英语)、ja(日语)、ko(韩语)、fr(法语)、es(西班牙语)、pt(葡萄牙语)、id(印尼语)、ru(俄语)、ms(马来语)，默认使用中文普通话 */
  language?: string;
}

/**
 * capabilityClient.load('speech_to_text_recording_convert_1').call<SpeechToTextRecordingConvertOneOutput>('speechToText', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { text } = result;
 * 返回值形如：
 *   {"text":"示例文本"}
 */
export interface SpeechToTextRecordingConvertOneOutput {
  /** [object Object] */
  text: string;
}
// ---- end:speech_to_text_recording_convert_1 ----

// ---- plugin:image_ocr_text_extraction_1 ----
// ============================================================
// 插件 image_ocr_text_extraction_1 (图片文字识别OCR) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface ImageOcrTextExtractionOneInput {
  /** 待识别文字的单张图片 */
  upload_image: string[];
}

/**
 * capabilityClient.load('image_ocr_text_extraction_1').callStream<ImageOcrTextExtractionOneOutput>('imageUnderstanding', input)
 * 每个 chunk 就是下面这个扁平对象，字段名与 ImageOcrTextExtractionOneOutput 一致，外面没有 data / choices / message 包装：
 *   {"reasoningContent":"","response":"示例文本","content":"示例文本"}
 * 返回值可能是 AsyncIterable<chunk>，也可能是 { output: AsyncIterable<chunk> }，取流前先归一化。
 * 逐段累加：
 *   for await (const chunk of stream) { result += chunk.reasoningContent ?? ''; }
 */
export interface ImageOcrTextExtractionOneOutput {
  /** [object Object] */
  reasoningContent?: string;
  /** [object Object] */
  response?: string;
  /** [object Object] */
  content: string;
}
// ---- end:image_ocr_text_extraction_1 ----