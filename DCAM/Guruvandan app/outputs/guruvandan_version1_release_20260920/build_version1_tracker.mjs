import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "C:/Users/ajayb/Downloads/Product Tracker_Guru Vandan.xlsx";
const outputDir = "D:/DCAM/Guruvandan app/outputs/guruvandan_version1_release_20260920";
const outputPath = `${outputDir}/Product Tracker_Guru Vandan_Version 1.xlsx`;

const crimson = "#981B25";
const deepCrimson = "#7D1119";
const offWhite = "#FFF9F0";
const paleRose = "#F7E1E1";
const paleGold = "#F3D08A";
const ink = "#2B2420";
const muted = "#6F625C";
const line = "#E4D3C4";
const successFill = "#EAF6EE";
const successText = "#1F6B3C";

const versionOneMilestones = [
  ["Vx.0", "Modern iOS-aligned visual refresh with shorter, heading-led content"],
  ["Vx.1", "Light/dark mode switch and readable dark-mode footer navigation"],
  ["Vx.2", "Daily Sacred Practice moved up, streak moved down, and first-timer streak corrected"],
  ["Vx.3", "Maharshi Mehi Paramhans and Satsang Samigri terminology updates"],
  ["Vx.4", "Daily quote schedule, future queue, quote-of-the-day logic, and archive"],
  ["Vx.5", "Quote sharing, exact-quote deep links, and Android/iOS store fallback"],
  ["Vx.6", "Persistent quote likes and user engagement event tracking"],
  ["Vx.7", "Browser admin portal with per-user timelines, combined statistics, and graphs"],
  ["Vx.8", "Seek sliders for satsang and aarti playback"],
  ["Vx.9", "Apple sign-in, provider linking, permanent account deletion, and session restore"],
  ["Vx.10", "Release 1.0.28 (31): meditation completion, lock-screen duration, and logout fixes"],
];

const features = [
  ["Design", "Visual system", "iOS-aligned spiritual interface", "Complete", "Refreshed cards, typography, spacing, navigation, and devotional colors across the app.", "A cleaner and more consistent experience on Android and iOS."],
  ["Design", "Content", "Explanation text removed", "Complete", "Long supporting copy was removed where a clear section heading already communicates the purpose.", "Screens are easier to scan and feel less crowded."],
  ["Appearance", "Theme", "Light and dark mode switch", "Complete", "Users can change the visual theme from the app.", "Comfortable viewing in bright and low-light settings."],
  ["Appearance", "Dark mode", "Readable footer navigation", "Complete", "Footer labels and icons use high-contrast colors in dark mode.", "Every navigation label remains visible."],
  ["Home", "Layout", "Daily Sacred Practice moved above streak", "Complete", "The primary daily action appears before continuity statistics.", "Users reach the daily routine faster."],
  ["Streak", "First use", "Yesterday streak hidden for first-time users", "Complete", "The previous-day indicator is omitted until the user has relevant history.", "New users are not shown misleading streak data."],
  ["Content", "Attribution", "Maharshi Mehi Paramhans naming", "Complete", "Previous Sadguru Maharaj wording was replaced throughout relevant app sections.", "Attribution is consistent with the approved name."],
  ["Content", "Localization", "Satsang Samigri Hindi label", "Complete", "The Hindi devotional-store wording was updated to Satsang Samigri.", "The label matches the requested terminology."],
  ["Wisdom", "Daily quote", "One scheduled quote per day", "Complete", "Only the quote assigned to the current date is presented as the daily quote.", "Users receive a focused daily teaching."],
  ["Wisdom", "Queue", "Future quote scheduling", "Complete", "Newly uploaded quotes fill upcoming dates in sequence.", "Administrators can prepare many days of content in advance."],
  ["Wisdom", "Archive", "Previous daily quotes archive", "Complete", "Quotes move into the archive after their scheduled day.", "Users can revisit earlier teachings."],
  ["Wisdom", "Deep link", "Open the exact shared quote", "Complete", "Shared links carry a quote identifier and route the installed app to that quote.", "Recipients land directly on the intended teaching."],
  ["Wisdom", "Store fallback", "Android and iOS install fallback", "Complete", "Shared quote links provide Google Play and App Store destinations when the app is unavailable.", "Recipients can install the correct app for their device."],
  ["Wisdom", "Sharing", "Guru Vandan share presentation", "Complete", "Quote sharing includes branded text, attribution, and a web/deep link.", "Shared content is recognizable and actionable."],
  ["Wisdom", "Engagement", "Persistent quote likes", "Complete", "Quote likes are stored and included in analytics.", "Popular teachings can be identified."],
  ["Audio", "Satsang", "Satsang seek slider", "Complete", "Users can drag the playback position backward or forward.", "Listeners can repeat or skip to a chosen part."],
  ["Audio", "Aarti", "Aarti seek slider", "Complete", "Aarti playback supports direct position seeking.", "Users have consistent controls across audio sections."],
  ["Analytics", "App usage", "App-open and screen-view tracking", "Complete", "Key navigation and app lifecycle events are recorded in Firebase.", "The team can understand adoption and screen usage."],
  ["Analytics", "Satsang", "Listening-time tracking", "Complete", "Actual satsang and aarti playback time is recorded.", "The admin portal can report real listening engagement."],
  ["Analytics", "Meditation", "Planned, actual, and completed time", "Complete", "Meditation starts, elapsed time, and successful completions are tracked.", "The team can compare intent with completed practice."],
  ["Analytics", "Wisdom", "Quote views, shares, and likes", "Complete", "Wisdom interactions are captured as structured events.", "The team can see which content users value."],
  ["Admin", "Access", "Browser admin portal", "Complete", "A responsive Firebase-hosted admin page is protected by administrator email/password authentication.", "Authorized staff can manage the app from a phone or browser."],
  ["Admin", "Users", "Per-user activity timeline", "Complete", "The portal shows what each user did and when.", "Support and engagement review can be user-specific."],
  ["Admin", "Dashboard", "Combined statistics and graphs", "Complete", "Aggregate totals, seven-day activity, and activity breakdowns are visualized.", "Overall app usage is understandable at a glance."],
  ["Admin", "Content", "Quote management and scheduling", "Complete", "Administrators can add, edit, schedule, and review quote content.", "Daily wisdom can be maintained without an app release."],
  ["Backend", "Security", "Admin-aware Firebase rules", "Complete", "Database access rules protect administration and user activity data.", "Sensitive management functions remain restricted."],
  ["Privacy", "Disclosure", "Analytics privacy disclosure", "Complete", "The privacy page documents app activity collection and its operational purpose.", "Users and reviewers receive clearer data-use information."],
  ["Authentication", "Apple", "Sign in with Apple", "Complete", "Apple authentication is integrated for supported devices.", "iOS users have a platform-native login option."],
  ["Authentication", "Linking", "Provider conflict handling", "Complete", "Existing identities can be linked when the same account uses another provider.", "Users avoid accidental duplicate accounts."],
  ["Account", "Deletion", "Permanent account deletion", "Complete", "Users can permanently delete their account and associated records, including provider revocation handling.", "Account controls meet user and store expectations."],
  ["Authentication", "Session", "Silent session restoration", "Complete", "A valid Google/Firebase session is restored before showing sign-in after the app is closed.", "Closing the app no longer signs the user out."],
  ["Meditation", "Completion", "Om meditation completes correctly", "Complete", "Timed Om playback now reaches the selected endpoint, plays the ending chant, and shows the completion message once.", "Users receive the expected end-of-session confirmation."],
  ["Meditation", "Lock screen", "Correct timer duration in media controls", "Complete", "The media source presented to Android uses the selected meditation duration instead of the full Om recording length.", "A one-minute session displays as one minute on the lock screen."],
  ["Release", "Android", "Signed Play Store app bundle", "Complete", "Version 1.0.28 with version code 31 was built, signed, and validated as an Android App Bundle.", "The corrected build is ready for internal testing upload."],
  ["Quality", "Verification", "Static analysis, tests, and bundle validation", "Complete", "Flutter analysis passed, 27 automated tests passed, and the AAB manifest/signature were verified.", "The release has repeatable technical checks before testing."],
];

const resolvedRequests = [
  ["Timed Om meditation did not play the ending chant or show the completion message.", "Timed playback now ends at the selected duration and runs the normal completion flow.", "Complete", "1.0.28 (31)", "Automated tests and release build passed; confirm once on an internal-test device."],
  ["A one-minute meditation appeared as roughly three hours on the lock screen.", "Android media metadata now exposes the selected timer duration instead of the source recording duration.", "Complete", "1.0.28 (31)", "AAB metadata/signature verified; confirm the media notification on a physical Android device."],
  ["Closing and reopening the app logged the user out.", "The app silently restores a valid Google/Firebase session before showing the sign-in screen.", "Complete", "1.0.28 (31)", "Authentication flow compiles and tests pass; confirm session persistence through internal testing."],
];

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

function style(range, config) {
  range.format = config;
}

function setWidth(sheet, column, width, endRow = 120) {
  sheet.getRange(`${column}1:${column}${endRow}`).format.columnWidth = width;
}

function setHeight(sheet, row, height, endColumn = "F") {
  sheet.getRange(`A${row}:${endColumn}${row}`).format.rowHeight = height;
}

const tech = workbook.worksheets.getItem("Technical Development");
tech.showGridLines = false;
tech.getRange("C3:C13").clear({ applyTo: "contents" });
tech.getRange("C3:C13").values = versionOneMilestones.map(([code, description]) => [
  `${code} — ${description}`,
]);
style(tech.getRange("C3:C13"), {
  fill: offWhite,
  font: { color: ink },
  wrapText: true,
  verticalAlignment: "top",
  borders: { preset: "all", style: "thin", color: line },
});
tech.getRange("D2").values = [["Version 2"]];
style(tech.getRange("D2"), {
  fill: crimson,
  font: { bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
});
setWidth(tech, "C", 52);
setWidth(tech, "D", 22);
for (let row = 3; row <= 13; row += 1) setHeight(tech, row, 46, "E");

const master = workbook.worksheets.getItem("Master");
master.showGridLines = false;
master.getRange("A19:B24").values = [
  ["Version 1 Summary", "Visual simplification, light/dark mode, daily quote scheduling and archive, deep-link sharing, analytics/admin dashboard, audio seeking, stronger account controls, and meditation/session reliability fixes."],
  ["Version 1 Release", "1.0.28 (version code 31) - September 20, 2026"],
  ["Admin Portal", "https://guru-vandan.web.app/admin.html"],
  ["Web App", "https://guru-vandan.web.app/"],
  ["Latest Android Bundle", "D:/DCAM/Guruvandan app/Guru-Vandan-1.0.28+31-meditation-session-fixes-playstore.aab"],
  ["Release Verification", "Flutter analysis passed; 27 tests passed; AAB package/version/signature validated."],
];
style(master.getRange("A19:A24"), {
  fill: paleRose,
  font: { bold: true, color: deepCrimson },
  verticalAlignment: "top",
  borders: { preset: "all", style: "thin", color: line },
});
style(master.getRange("B19:B24"), {
  fill: offWhite,
  font: { color: ink },
  wrapText: true,
  verticalAlignment: "top",
  borders: { preset: "all", style: "thin", color: line },
});
master.getRange("A19:B24").format.rowHeight = 42;
master.getRange("A1:A24").format.columnWidth = 24;
master.getRange("B1:B24").format.columnWidth = 118;

const detail = workbook.worksheets.getOrAdd("Version 1 Details");
detail.deleteAllDrawings();
detail.showGridLines = false;
detail.getRange("A1:F100").clear({ applyTo: "all" });

detail.getRange("A1:F1").merge();
detail.getRange("A1").values = [["Guru Vandan - Version 1 Feature Tracker"]];
style(detail.getRange("A1:F1"), {
  fill: deepCrimson,
  font: { bold: true, color: "#FFFFFF", size: 16 },
  horizontalAlignment: "center",
});

detail.getRange("A2:F2").merge();
detail.getRange("A2").values = [["Completed work through Android release 1.0.28 (31), including the three latest reliability fixes."]];
style(detail.getRange("A2:F2"), {
  fill: offWhite,
  font: { italic: true, color: muted },
  horizontalAlignment: "center",
});

const featureEnd = features.length + 8;
detail.getRange("A4:B6").values = [
  ["Version", "Version 1"],
  ["Status", "Ready for internal testing"],
  ["Last updated", new Date("2026-09-20T00:00:00")],
];
detail.getRange("D4:E6").values = [
  ["Total items", null],
  ["Completed", null],
  ["Open", null],
];
detail.getRange("E4").formulas = [[`=COUNTA(C9:C${featureEnd})`]];
detail.getRange("E5").formulas = [[`=COUNTIF(D9:D${featureEnd},"Complete")`]];
detail.getRange("E6").formulas = [[`=COUNTIF(D9:D${featureEnd},"<>Complete")`]];
style(detail.getRange("A4:E6"), {
  fill: "#FFFFFF",
  font: { color: ink },
  borders: { preset: "all", style: "thin", color: line },
});
style(detail.getRange("A4:A6"), { fill: paleRose, font: { bold: true, color: deepCrimson } });
style(detail.getRange("D4:D6"), { fill: paleRose, font: { bold: true, color: deepCrimson } });
detail.getRange("B6").format.numberFormat = "yyyy-mm-dd";
detail.getRange("E4:E6").format.numberFormat = "#,##0";

detail.getRange("A8:F8").values = [["Category", "Area", "Feature", "Status", "Implementation notes", "User benefit"]];
style(detail.getRange("A8:F8"), {
  fill: crimson,
  font: { bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
});
detail.getRange(`A9:F${featureEnd}`).values = features;
style(detail.getRange(`A9:F${featureEnd}`), {
  fill: "#FFFFFF",
  font: { color: ink, size: 10 },
  wrapText: true,
  verticalAlignment: "top",
  borders: {
    insideHorizontal: { style: "thin", color: "#EFE3D7" },
    insideVertical: { style: "thin", color: "#EFE3D7" },
    top: { style: "thin", color: line },
    bottom: { style: "thin", color: line },
    left: { style: "thin", color: line },
    right: { style: "thin", color: line },
  },
});
style(detail.getRange(`A9:A${featureEnd}`), {
  fill: offWhite,
  font: { bold: true, color: deepCrimson, size: 10 },
});
style(detail.getRange(`D9:D${featureEnd}`), {
  fill: successFill,
  font: { bold: true, color: successText, size: 10 },
  horizontalAlignment: "center",
});
detail.getRange(`D9:D${featureEnd}`).dataValidation = {
  rule: { type: "list", values: ["Complete", "Ready", "Planned", "Blocked"] },
};

const requestTitleRow = featureEnd + 2;
const requestHeaderRow = requestTitleRow + 1;
const requestStartRow = requestHeaderRow + 1;
const requestEndRow = requestStartRow + resolvedRequests.length - 1;
detail.getRange(`A${requestTitleRow}:F${requestTitleRow}`).merge();
detail.getRange(`A${requestTitleRow}`).values = [["Need to be done - received for Version 1 and resolved in this build"]];
style(detail.getRange(`A${requestTitleRow}:F${requestTitleRow}`), {
  fill: paleGold,
  font: { bold: true, color: deepCrimson, size: 12 },
  horizontalAlignment: "center",
});
detail.getRange(`A${requestHeaderRow}:E${requestHeaderRow}`).values = [["Reported issue", "Resolution", "Status", "Build", "Verification / next check"]];
detail.getRange(`E${requestHeaderRow}:F${requestHeaderRow}`).merge();
style(detail.getRange(`A${requestHeaderRow}:F${requestHeaderRow}`), {
  fill: crimson,
  font: { bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
});
for (let index = 0; index < resolvedRequests.length; index += 1) {
  const row = requestStartRow + index;
  const [issue, resolution, status, build, verification] = resolvedRequests[index];
  detail.getRange(`A${row}:D${row}`).values = [[issue, resolution, status, build]];
  detail.getRange(`E${row}:F${row}`).merge();
  detail.getRange(`E${row}`).values = [[verification]];
}
style(detail.getRange(`A${requestStartRow}:F${requestEndRow}`), {
  fill: "#FFFFFF",
  font: { color: ink, size: 10 },
  wrapText: true,
  verticalAlignment: "top",
  borders: { preset: "all", style: "thin", color: line },
});
style(detail.getRange(`C${requestStartRow}:C${requestEndRow}`), {
  fill: successFill,
  font: { bold: true, color: successText, size: 10 },
  horizontalAlignment: "center",
});

setWidth(detail, "A", 20);
setWidth(detail, "B", 22);
setWidth(detail, "C", 34);
setWidth(detail, "D", 15);
setWidth(detail, "E", 54);
setWidth(detail, "F", 44);
for (let row = 9; row <= featureEnd; row += 1) setHeight(detail, row, 48);
setHeight(detail, requestTitleRow, 28);
setHeight(detail, requestHeaderRow, 30);
for (let row = requestStartRow; row <= requestEndRow; row += 1) setHeight(detail, row, 68);
detail.freezePanes.freezeRows(8);

workbook.recalculate();

const check = await workbook.inspect({
  kind: "table",
  range: `Version 1 Details!A1:F${requestEndRow}`,
  include: "values,formulas",
  tableMaxRows: 60,
  tableMaxCols: 8,
  summary: "Version 1 tracker verification",
});
await fs.writeFile(`${outputDir}/version1_tracker.inspect.ndjson`, check.ndjson, "utf8");

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 200 },
  summary: "formula error scan",
});
await fs.writeFile(`${outputDir}/formula_errors.inspect.ndjson`, errors.ndjson, "utf8");
console.log("FORMULA_ERRORS", errors.ndjson);

const previews = [
  ["preview_master.png", "Master", "A14:B24"],
  ["preview_technical.png", "Technical Development", "A1:E13"],
  ["preview_version1_top.png", "Version 1 Details", "A1:F20"],
  ["preview_version1_mid.png", "Version 1 Details", "A21:F36"],
  ["preview_version1_bottom.png", "Version 1 Details", `A37:F${requestEndRow}`],
];
for (const [filename, sheetName, range] of previews) {
  const image = await workbook.render({ sheetName, range, scale: 1.5, format: "png" });
  await fs.writeFile(`${outputDir}/${filename}`, new Uint8Array(await image.arrayBuffer()));
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
console.log(`FEATURE_END=${featureEnd} REQUEST_END=${requestEndRow}`);
