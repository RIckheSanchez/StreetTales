package com.streettales.speech

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class SpeechPackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
        listOf(SpeechModule(context))

    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
