val firebaseProjectId = providers.gradleProperty("FIREBASE_PROJECT_ID").orNull ?: System.getenv("FIREBASE_PROJECT_ID") ?: ""
val firebaseApplicationId = providers.gradleProperty("FIREBASE_APPLICATION_ID").orNull ?: System.getenv("FIREBASE_APPLICATION_ID") ?: ""
val firebaseApiKey = providers.gradleProperty("FIREBASE_API_KEY").orNull ?: System.getenv("FIREBASE_API_KEY") ?: ""
val firebaseSenderId = providers.gradleProperty("FIREBASE_SENDER_ID").orNull ?: System.getenv("FIREBASE_SENDER_ID") ?: ""
val qaEdgeUrl = providers.gradleProperty("QA_EDGE_URL").orNull ?: System.getenv("QA_EDGE_URL") ?: ""
val qaSupabasePublishableKey = providers.gradleProperty("QA_SUPABASE_PUBLISHABLE_KEY").orNull ?: System.getenv("QA_SUPABASE_PUBLISHABLE_KEY") ?: ""

plugins { id("com.android.application") }
android { namespace = "com.nuestragalaxia.companion"; compileSdk = 36
 defaultConfig { applicationId = "com.nuestragalaxia.companion"; minSdk = 26; targetSdk = 36; versionCode = 34; versionName = "3.5.0"; buildConfigField("String","SUPABASE_URL","\"https://zqiknzivfahvvadmxrvt.supabase.co\""); buildConfigField("String","SUPABASE_PUBLISHABLE_KEY","\"sb_publishable_c3SvE2qIJthLwd7IcEYSmA_OU2Ku9rT\""); buildConfigField("String","EDGE_URL","\"https://zqiknzivfahvvadmxrvt.supabase.co/functions/v1/android-companion\""); buildConfigField("String","FIREBASE_PROJECT_ID","\"$firebaseProjectId\""); buildConfigField("String","FIREBASE_APPLICATION_ID","\"$firebaseApplicationId\""); buildConfigField("String","FIREBASE_API_KEY","\"$firebaseApiKey\""); buildConfigField("String","FIREBASE_SENDER_ID","\"$firebaseSenderId\""); testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner" }
 buildTypes {
   getByName("debug") {
     if (qaEdgeUrl.isNotBlank()) buildConfigField("String","EDGE_URL","\"$qaEdgeUrl\"")
     if (qaSupabasePublishableKey.isNotBlank()) buildConfigField("String","SUPABASE_PUBLISHABLE_KEY","\"$qaSupabasePublishableKey\"")
   }
 }
 buildFeatures { buildConfig = true }; compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 } }
dependencies {
 implementation("com.google.firebase:firebase-messaging:25.1.3")
 implementation("com.google.android.gms:play-services-location:21.4.0")
 implementation("androidx.core:core:1.19.1")
 implementation("androidx.activity:activity:1.13.0")
 implementation("androidx.fragment:fragment:1.9.1")
 implementation("androidx.biometric:biometric:1.1.0")
 implementation("androidx.work:work-runtime:2.11.2")
 implementation("androidx.webkit:webkit:1.15.0")
 testImplementation("junit:junit:4.13.2")
 androidTestImplementation("androidx.test:core:1.7.0")
 androidTestImplementation("androidx.test:runner:1.7.0")
 androidTestImplementation("androidx.test:rules:1.7.0")
 androidTestImplementation("androidx.test.ext:junit:1.3.0")
 androidTestImplementation("androidx.test.espresso:espresso-core:3.7.0")
 androidTestImplementation("androidx.test.uiautomator:uiautomator:2.4.0")
}
