val giphyApiKey = providers.gradleProperty("GIPHY_API_KEY").orNull ?: System.getenv("GIPHY_API_KEY") ?: ""
val firebaseProjectId = providers.gradleProperty("FIREBASE_PROJECT_ID").orNull ?: System.getenv("FIREBASE_PROJECT_ID") ?: ""
val firebaseApplicationId = providers.gradleProperty("FIREBASE_APPLICATION_ID").orNull ?: System.getenv("FIREBASE_APPLICATION_ID") ?: ""
val firebaseApiKey = providers.gradleProperty("FIREBASE_API_KEY").orNull ?: System.getenv("FIREBASE_API_KEY") ?: ""
val firebaseSenderId = providers.gradleProperty("FIREBASE_SENDER_ID").orNull ?: System.getenv("FIREBASE_SENDER_ID") ?: ""
val qaEdgeUrl = providers.gradleProperty("QA_EDGE_URL").orNull ?: System.getenv("QA_EDGE_URL") ?: "https://vwtcncvmwjfywrzjmskw.supabase.co/functions/v1/android-companion"
val qaSupabasePublishableKey = providers.gradleProperty("QA_SUPABASE_PUBLISHABLE_KEY").orNull ?: System.getenv("QA_SUPABASE_PUBLISHABLE_KEY") ?: "sb_publishable_H2wISjcUmDX3FmL0j6IxEw_ntJwm_JG"

plugins { id("com.android.application") }
android { namespace = "com.nuestragalaxia.companion"; compileSdk = 36
 defaultConfig { applicationId = "com.nuestragalaxia.companion"; minSdk = 26; targetSdk = 36; versionCode = 38; versionName = "4.1.1"; buildConfigField("String","SUPABASE_URL","\"https://zqiknzivfahvvadmxrvt.supabase.co\""); buildConfigField("String","SUPABASE_PUBLISHABLE_KEY","\"sb_publishable_c3SvE2qIJthLwd7IcEYSmA_OU2Ku9rT\""); buildConfigField("String","EDGE_URL","\"https://zqiknzivfahvvadmxrvt.supabase.co/functions/v1/android-companion\""); buildConfigField("String","GIPHY_API_KEY","\"$giphyApiKey\""); buildConfigField("String","FIREBASE_PROJECT_ID","\"$firebaseProjectId\""); buildConfigField("String","FIREBASE_APPLICATION_ID","\"$firebaseApplicationId\""); buildConfigField("String","FIREBASE_API_KEY","\"$firebaseApiKey\""); buildConfigField("String","FIREBASE_SENDER_ID","\"$firebaseSenderId\""); testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner" }
 buildTypes {
   getByName("debug") {
     applicationIdSuffix = providers.gradleProperty("QA_APPLICATION_SUFFIX").orNull ?: ""
     if (qaEdgeUrl.isNotBlank()) buildConfigField("String","EDGE_URL","\"$qaEdgeUrl\"")
     // Every debug APK is QA-only, even with a hermetic loopback API.
     val qaOrigin = "https://vwtcncvmwjfywrzjmskw.supabase.co"
     check(qaEdgeUrl == "$qaOrigin/functions/v1/android-companion" || qaEdgeUrl == "http://127.0.0.1:18765") {
       "QA debug builds require exact QA Edge endpoint or isolated local instrumentation."
     }
     buildConfigField("String","SUPABASE_URL","\"$qaOrigin\"")
     if (qaSupabasePublishableKey.isNotBlank()) buildConfigField("String","SUPABASE_PUBLISHABLE_KEY","\"$qaSupabasePublishableKey\"")
   }
 }
 buildFeatures { buildConfig = true }; compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 } }
dependencies {
 implementation("com.google.firebase:firebase-messaging:25.1.3")
 implementation("com.google.android.gms:play-services-location:21.4.0")
 implementation("androidx.core:core:1.17.0")
 implementation("androidx.activity:activity:1.13.0")
 implementation("androidx.fragment:fragment:1.9.1")
 implementation("androidx.biometric:biometric:1.1.0")
 implementation("androidx.work:work-runtime:2.12.0")
 implementation("androidx.webkit:webkit:1.15.0")
 implementation("androidx.camera:camera-core:1.5.3")
 implementation("androidx.camera:camera-camera2:1.5.3")
 implementation("androidx.camera:camera-lifecycle:1.5.3")
 implementation("androidx.camera:camera-view:1.5.3")
 implementation("androidx.camera:camera-video:1.5.3")
 testImplementation("junit:junit:4.13.2")
 androidTestImplementation("androidx.test:core:1.7.0")
 androidTestImplementation("androidx.test:runner:1.7.0")
 androidTestImplementation("androidx.test:rules:1.7.0")
 androidTestImplementation("androidx.test.ext:junit:1.3.0")
 androidTestImplementation("androidx.test.espresso:espresso-core:3.7.0")
 androidTestImplementation("androidx.test.uiautomator:uiautomator:2.4.0")
}

// Windows Java 17 defaults to Cp1252; all Android Java tests and string assertions are UTF-8.
tasks.withType<org.gradle.api.tasks.compile.JavaCompile>().configureEach { options.encoding = "UTF-8" }
