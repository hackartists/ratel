#import "RatelFiles.h"

#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>

/// A4 at 72dpi, and a 24pt gutter. Matches the ISO_A4 media size the Android
/// side asks `PrintManager` for, so a report exported from either app comes out
/// on the same page geometry.
static const CGFloat kRatelPageWidth = 595.2f;
static const CGFloat kRatelPageHeight = 841.8f;
static const CGFloat kRatelPageInset = 24.0f;

/// Strip anything that would let a caller-supplied name break out of the temp
/// directory or collide with path syntax.
static NSString *RatelSanitizeFileName(NSString *name) {
    NSCharacterSet *illegal = [NSCharacterSet characterSetWithCharactersInString:@"/\\:*?\"<>|"];
    NSString *cleaned = [[name componentsSeparatedByCharactersInSet:illegal]
        componentsJoinedByString:@"_"];
    cleaned = [cleaned stringByTrimmingCharactersInSet:
        [NSCharacterSet whitespaceAndNewlineCharacterSet]];
    return cleaned.length > 0 ? cleaned : @"ratel-download";
}

/// The controller a share sheet can actually be presented from.
///
/// Tauri owns the window and its root controller, and a modal (the Google
/// sign-in sheet, say) may already be up — presenting on a controller that is
/// itself covered silently does nothing, so walk to the topmost one.
static UIViewController *RatelTopViewController(void *webviewPtr) {
    UIView *view = (__bridge UIView *)webviewPtr;
    UIViewController *root = view.window.rootViewController;
    if (root == nil) {
        // Fall back to the active scene's window when the view isn't attached
        // yet (shouldn't happen from a user tap, but never crash for it).
        for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
            if ([scene isKindOfClass:UIWindowScene.class]) {
                for (UIWindow *w in ((UIWindowScene *)scene).windows) {
                    if (w.isKeyWindow) { root = w.rootViewController; break; }
                }
            }
            if (root != nil) { break; }
        }
    }
    while (root.presentedViewController != nil) {
        root = root.presentedViewController;
    }
    return root;
}

/// Present a share sheet for `fileURL`.
///
/// The popover anchor is not optional: on iPad an activity sheet with no
/// `sourceView` raises `NSGenericException` and takes the app down. iPhone
/// ignores it, so it is set unconditionally.
static BOOL RatelPresentShareSheet(NSURL *fileURL, void *webviewPtr) {
    UIViewController *presenter = RatelTopViewController(webviewPtr);
    if (presenter == nil) {
        NSLog(@"[RatelFiles] no view controller to present from");
        return NO;
    }

    UIActivityViewController *sheet =
        [[UIActivityViewController alloc] initWithActivityItems:@[ fileURL ]
                                          applicationActivities:nil];

    UIView *anchor = (__bridge UIView *)webviewPtr;
    UIPopoverPresentationController *popover = sheet.popoverPresentationController;
    if (popover != nil) {
        popover.sourceView = anchor;
        popover.sourceRect = CGRectMake(CGRectGetMidX(anchor.bounds),
                                        CGRectGetMidY(anchor.bounds),
                                        1.0f,
                                        1.0f);
        popover.permittedArrowDirections = 0;
    }

    [presenter presentViewController:sheet animated:YES completion:nil];
    return YES;
}

/// `used` + default visibility keep these two out of the linker's jaws.
///
/// Rust resolves them with `dlsym` at runtime (see `commands/native_file.rs`
/// for why it can't link against them), so nothing in the app references them
/// at link time and `ld -dead_strip` removes them — verified: both symbols are
/// `T` in RatelFiles.o and absent from the built Ratel.app binary. The
/// attribute sets the Mach-O no-dead-strip flag, which is what makes the
/// runtime lookup find anything. Android needs the same protection from R8
/// (see proguard-rules.pro).
#define RATEL_EXPORTED __attribute__((used)) __attribute__((visibility("default")))

RATEL_EXPORTED
BOOL ratel_save_and_share(const char *fileName, const char *bodyB64, void *webview) {
    @autoreleasepool {
        if (fileName == NULL || bodyB64 == NULL || webview == NULL) {
            return NO;
        }

        NSString *name = RatelSanitizeFileName(
            [NSString stringWithUTF8String:fileName]);
        NSString *b64 = [NSString stringWithUTF8String:bodyB64];

        NSData *data = [[NSData alloc]
            initWithBase64EncodedString:b64
                                options:NSDataBase64DecodingIgnoreUnknownCharacters];
        if (data == nil) {
            NSLog(@"[RatelFiles] base64 decode failed for %@", name);
            return NO;
        }

        // A per-call subdirectory keeps two exports of the same name from
        // overwriting each other while an earlier share sheet is still open.
        NSString *dir = [NSTemporaryDirectory()
            stringByAppendingPathComponent:[NSUUID UUID].UUIDString];
        NSError *dirErr = nil;
        if (![NSFileManager.defaultManager createDirectoryAtPath:dir
                                    withIntermediateDirectories:YES
                                                     attributes:nil
                                                          error:&dirErr]) {
            NSLog(@"[RatelFiles] temp dir failed: %@", dirErr);
            return NO;
        }

        NSString *path = [dir stringByAppendingPathComponent:name];
        NSError *writeErr = nil;
        if (![data writeToFile:path options:NSDataWritingAtomic error:&writeErr]) {
            NSLog(@"[RatelFiles] write failed: %@", writeErr);
            return NO;
        }

        return RatelPresentShareSheet([NSURL fileURLWithPath:path], webview);
    }
}

RATEL_EXPORTED
BOOL ratel_print_webview(const char *jobName, void *webview) {
    @autoreleasepool {
        if (jobName == NULL || webview == NULL) {
            return NO;
        }

        WKWebView *wk = (__bridge WKWebView *)webview;
        if (![wk isKindOfClass:WKWebView.class]) {
            NSLog(@"[RatelFiles] not a WKWebView");
            return NO;
        }

        NSString *name = RatelSanitizeFileName([NSString stringWithUTF8String:jobName]);
        if (![name.pathExtension.lowercaseString isEqualToString:@"pdf"]) {
            name = [name stringByAppendingPathExtension:@"pdf"];
        }

        // `viewPrintFormatter` renders with print media, so the report's
        // `@media print` rules (page margins, chart colours) apply — which is
        // why this is not `createPDFWithConfiguration:`, whose screen-media
        // output would not match the web export.
        UIPrintPageRenderer *renderer = [[UIPrintPageRenderer alloc] init];
        [renderer addPrintFormatter:wk.viewPrintFormatter startingAtPageAtIndex:0];

        CGRect paper = CGRectMake(0, 0, kRatelPageWidth, kRatelPageHeight);
        CGRect printable = CGRectInset(paper, kRatelPageInset, kRatelPageInset);
        // `paperRect` / `printableRect` are readonly in the public API; KVC is
        // the long-standing way to drive UIPrintPageRenderer outside an actual
        // print job, and is what makes offline PDF rendering possible at all.
        [renderer setValue:[NSValue valueWithCGRect:paper] forKey:@"paperRect"];
        [renderer setValue:[NSValue valueWithCGRect:printable] forKey:@"printableRect"];

        NSInteger pages = renderer.numberOfPages;
        if (pages <= 0) {
            NSLog(@"[RatelFiles] renderer produced no pages");
            return NO;
        }

        NSMutableData *pdf = [NSMutableData data];
        UIGraphicsBeginPDFContextToData(pdf, paper, nil);
        for (NSInteger i = 0; i < pages; i++) {
            UIGraphicsBeginPDFPage();
            [renderer drawPageAtIndex:i inRect:UIGraphicsGetPDFContextBounds()];
        }
        UIGraphicsEndPDFContext();

        if (pdf.length == 0) {
            NSLog(@"[RatelFiles] empty pdf");
            return NO;
        }

        NSString *dir = [NSTemporaryDirectory()
            stringByAppendingPathComponent:[NSUUID UUID].UUIDString];
        NSError *dirErr = nil;
        if (![NSFileManager.defaultManager createDirectoryAtPath:dir
                                    withIntermediateDirectories:YES
                                                     attributes:nil
                                                          error:&dirErr]) {
            NSLog(@"[RatelFiles] temp dir failed: %@", dirErr);
            return NO;
        }

        NSString *path = [dir stringByAppendingPathComponent:name];
        NSError *writeErr = nil;
        if (![pdf writeToFile:path options:NSDataWritingAtomic error:&writeErr]) {
            NSLog(@"[RatelFiles] pdf write failed: %@", writeErr);
            return NO;
        }

        return RatelPresentShareSheet([NSURL fileURLWithPath:path], webview);
    }
}
