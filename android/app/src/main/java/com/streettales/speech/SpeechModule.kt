package com.streettales.speech

import android.app.Activity
import android.content.Intent
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.RecognitionListener
import android.os.Bundle
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class SpeechModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    companion object {
        const val TAG = "SpeechModule"
        const val REQUEST_CODE = 7412
        const val EVENT_RESULT = "SpeechResult"
        const val EVENT_ERROR = "SpeechError"
        const val EVENT_START = "SpeechStart"
        const val EVENT_END = "SpeechEnd"
    }

    private var speechRecognizer: SpeechRecognizer? = null
    private var useServiceMode = false

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName() = "SpeechModule"

    private fun emit(event: String, data: Any?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(event, data)
    }

    @ReactMethod
    fun startListening(locale: String, promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current activity")
            return
        }

        // First try service-based recognition (faster, works on non-Huawei)
        if (SpeechRecognizer.isRecognitionAvailable(reactContext)) {
            tryServiceRecognition(locale, activity, promise)
        } else {
            // Fallback to intent-based (works on Huawei)
            startIntentRecognition(locale, activity, promise)
        }
    }

    private fun tryServiceRecognition(locale: String, activity: Activity, promise: Promise) {
        try {
            speechRecognizer?.destroy()
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(reactContext)
            speechRecognizer?.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    Log.d(TAG, "onReadyForSpeech")
                    emit(EVENT_START, null)
                    promise.resolve("started")
                }
                override fun onBeginningOfSpeech() { Log.d(TAG, "onBeginningOfSpeech") }
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {
                    Log.d(TAG, "onEndOfSpeech")
                    emit(EVENT_END, null)
                }
                override fun onError(error: Int) {
                    Log.e(TAG, "onError: $error")
                    if (error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY ||
                        error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
                        // Service mode failed — fall back to intent
                        Log.d(TAG, "Service mode failed ($error), falling back to intent")
                        activity.runOnUiThread {
                            startIntentRecognition(locale, activity, promise)
                        }
                    } else {
                        val msg = errorToMessage(error)
                        emit(EVENT_ERROR, msg)
                    }
                }
                override fun onResults(results: Bundle?) {
                    val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    val text = matches?.firstOrNull() ?: ""
                    Log.d(TAG, "onResults: $text")
                    val arr = Arguments.createArray()
                    arr.pushString(text)
                    emit(EVENT_RESULT, arr)
                }
                override fun onPartialResults(partialResults: Bundle?) {
                    val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    val text = matches?.firstOrNull() ?: ""
                    if (text.isNotEmpty()) {
                        val arr = Arguments.createArray()
                        arr.pushString(text)
                        emit(EVENT_RESULT, arr)
                    }
                }
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })

            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale.ifEmpty { "zh-CN" })
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, locale.ifEmpty { "zh-CN" })
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2000L)
            }
            speechRecognizer?.startListening(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Service recognition failed: ${e.message}, falling back to intent")
            startIntentRecognition(locale, activity, promise)
        }
    }

    private fun startIntentRecognition(locale: String, activity: Activity, promise: Promise) {
        Log.d(TAG, "Using intent-based recognition")
        useServiceMode = false
        try {
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale.ifEmpty { "zh-CN" })
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, locale.ifEmpty { "zh-CN" })
                putExtra(RecognizerIntent.EXTRA_PROMPT, "请说话...")
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            }
            emit(EVENT_START, null)
            activity.startActivityForResult(intent, REQUEST_CODE)
            promise.resolve("started_intent")
        } catch (e: Exception) {
            Log.e(TAG, "Intent recognition also failed: ${e.message}")
            promise.reject("NOT_AVAILABLE", "语音识别不可用: ${e.message}")
        }
    }

    @ReactMethod
    fun stopListening(promise: Promise) {
        try {
            speechRecognizer?.stopListening()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun destroy(promise: Promise) {
        speechRecognizer?.destroy()
        speechRecognizer = null
        promise.resolve(null)
    }

    @ReactMethod
    fun isAvailable(promise: Promise) {
        promise.resolve(true)
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST_CODE) return
        emit(EVENT_END, null)

        if (resultCode == Activity.RESULT_OK && data != null) {
            val matches = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            val text = matches?.firstOrNull() ?: ""
            Log.d(TAG, "Intent result: $text")
            val arr = Arguments.createArray()
            arr.pushString(text)
            emit(EVENT_RESULT, arr)
        } else {
            emit(EVENT_ERROR, "Recognition cancelled or failed (code $resultCode)")
        }
    }

    override fun onNewIntent(intent: Intent?) {}

    private fun errorToMessage(error: Int) = when (error) {
        SpeechRecognizer.ERROR_AUDIO -> "音频错误"
        SpeechRecognizer.ERROR_CLIENT -> "客户端错误"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "权限不足"
        SpeechRecognizer.ERROR_NETWORK -> "网络错误"
        SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "网络超时"
        SpeechRecognizer.ERROR_NO_MATCH -> "未识别到语音"
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "识别器忙"
        SpeechRecognizer.ERROR_SERVER -> "服务器错误"
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "语音超时"
        else -> "未知错误 ($error)"
    }
}
