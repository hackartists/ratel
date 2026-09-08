# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile
# JNI entry points on MainActivity.
#
# `commands/native_file.rs` looks these up by name through the JNI handle
# `window.with_webview` provides, so nothing in Kotlin references them. R8 sees
# that as dead code and strips them (verified: neither name appeared in
# classes.dex), and the lookup then fails with NoSuchMethodError — the file
# save and the report PDF export both die with no visible cause, because the
# release build also drops the Log.e that would have said so.
-keepclassmembers class co.biyard.ratel.MainActivity {
    public boolean ratelSaveFile(java.lang.String, java.lang.String, java.lang.String);
    public boolean ratelPrintPage(java.lang.String);
}
