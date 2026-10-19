import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "C:/Users/ajayb/Downloads/Product Tracker_Guru Vandan.xlsx";
const outputDir = "D:/DCAM/Guruvandan app/outputs/guruvandan_product_tracker_edit";
const outputPath = `${outputDir}/Product Tracker_Guru Vandan_edited.xlsx`;

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

const versionZeroMilestones = [
  ["Vx.0", "Flutter app base, Firebase setup, Android, web, and iOS project structure"],
  ["Vx.1", "First launch language choice, Google sign-in, and phone OTP sign-in"],
  ["Vx.2", "First-time profile setup with first, middle, and last name"],
  ["Vx.3", "Spiritual home screen, first-name greeting, and welcome popup"],
  ["Vx.4", "Offline morning satsang, evening satsang, and aarti audio"],
  ["Vx.5", "Meditation timer with presets, custom hours/minutes, Om, and ending chant"],
  ["Vx.6", "Meditation-only streak tracking with current, best, and total days"],
  ["Vx.7", "Dynamic bilingual wisdom quotes from admin with share option"],
  ["Vx.8", "More page with language switch, change name, coming soon modules, and logout"],
  ["Vx.9", "Admin panel for quotes, editing, newest-first list, and user activity view"],
  ["Vx.10", "Release build: Android APK ready, web deployed, iOS files prepared"],
];

const features = [
  ["Branding", "App identity", "Device app name shows Guru Vandan", "Complete", "Android, iOS, and web manifest naming updated.", "Users see the correct devotional app name."],
  ["Branding", "Logo", "Guru Vandan logo applied", "Complete", "The shared Guru Vandan logo replaced the default Flutter icon.", "The app feels official and recognizable."],
  ["Design", "Theme", "Spiritual crimson and off-white UI", "Complete", "Crimson, off-white, soft gold, and calm devotional styling used throughout.", "The interface feels aligned with the spiritual school."],
  ["Design", "Accessibility", "Elder-friendly visual layout", "Complete", "Large text, simple actions, and spacious controls.", "Older devotees can use the app with less confusion."],
  ["Language", "First launch", "Language selection before sign-in", "Complete", "User chooses English or Hindi before authentication.", "The app starts in the user's preferred language."],
  ["Language", "Settings", "Language switch in More", "Complete", "Language can be changed later from the More page.", "Users can switch language anytime."],
  ["Authentication", "Google", "Google sign-in", "Complete", "Google authentication flow added through Firebase.", "Users can enter the app quickly with Google."],
  ["Authentication", "Phone", "Phone OTP sign-in", "Complete", "Phone number and OTP flow added.", "Users without Google login can still sign in."],
  ["Authentication", "Return users", "Existing account handling", "Complete", "Known users are not asked for name again after login.", "Repeat login feels smooth."],
  ["Profile", "Onboarding", "First-time name setup", "Complete", "First name, middle name, and last name captured separately.", "Profiles are cleaner and easier to personalize."],
  ["Profile", "Greeting", "Home shows first name only", "Complete", "Greeting uses first name instead of full name.", "The home screen feels personal without being crowded."],
  ["Profile", "Edit name", "Change name option in More", "Complete", "User can update name from the More page.", "Wrong or changed names can be corrected."],
  ["Home", "Welcome", "Classy spiritual welcome popup", "Complete", "Shown after new user signup/name setup.", "First entry feels warm and ceremonial."],
  ["Home", "Navigation", "Morning, Evening, and Dhyan quick buttons", "Complete", "Home cards navigate to their correct tabs/pages.", "Main routines are reachable in one tap."],
  ["Home", "Information", "Collapsible About sections", "Complete", "About Guru Maharaj and About Guru Vandan content added.", "Important context is present without overwhelming the home page."],
  ["Routine", "Daily tracking", "Routine completion tracking", "Complete", "Satsang, aarti, and meditation completion can be tracked.", "Devotees can see their daily spiritual practice progress."],
  ["Satsang", "Morning", "Morning satsang audio bundled offline", "Complete", "Morning satsang audio is inside the APK assets.", "No waiting for download before playback."],
  ["Satsang", "Evening", "Evening satsang audio bundled offline", "Complete", "Shaam satsang audio is inside the APK assets.", "Evening satsang works directly from the app."],
  ["Satsang", "Aarti", "Aarti tab and audio", "Complete", "Separate Aarti tab added with bundled Aarti audio.", "Aarti has its own clear place."],
  ["Satsang", "Player", "Audio progress and duration", "Complete", "Playback progress and total duration are shown.", "Users understand where they are in the satsang."],
  ["Satsang", "Completion", "Complete button", "Complete", "User can mark satsang and aarti as complete.", "Routine progress is explicit."],
  ["Audio", "Silent mode", "Silent phone popup before playback", "Complete", "Popup asks user to put phone on silent before satsang or meditation starts.", "Practice begins with fewer distractions."],
  ["Audio", "Background", "Background playback and notification", "Complete", "Satsang, meditation, and Om continue when app is minimized.", "Audio does not stop during practice."],
  ["Meditation", "Preset timer", "Preset meditation durations", "Complete", "5, 10, 15, 20, 25, and 30 minute options.", "Users can start common sessions quickly."],
  ["Meditation", "Custom timer", "Custom hours and minutes picker", "Complete", "Scrollable custom time picker added.", "Longer or personal durations are supported."],
  ["Meditation", "Controls", "Start, pause, and reset", "Complete", "Timer control buttons added.", "Users stay in control of the session."],
  ["Meditation", "Ending chant", "Chant plays only when timer ends", "Complete", "Opening chant was removed; closing chant plays after timed meditation.", "Meditation time remains pure and uninterrupted."],
  ["Meditation", "Om toggle", "Om mantra background audio", "Complete", "Om audio can play endlessly when no meditation timer is running.", "Users can listen for calm focus outside timer sessions."],
  ["Meditation", "Om with timer", "Om stops before final chant", "Complete", "If timer is running, Om stops before the closing chant plays.", "Audio sequence remains clean."],
  ["Streak", "Meditation streak", "Meditation-only streak logic", "Complete", "Streak depends only on daily meditation continuity.", "Users are encouraged to meditate daily."],
  ["Streak", "Stats", "Current, best, and total meditation days", "Complete", "Streak area explains continuity, not duration.", "The meaning of the streak is easy to understand."],
  ["Wisdom", "Dynamic quotes", "Quotes fetched dynamically from Firebase", "Complete", "Wisdom page loads all admin-uploaded quotes when online.", "New wisdom appears without rebuilding the app."],
  ["Wisdom", "Newest first", "Latest quote appears at top", "Complete", "Admin quotes are ordered newest first.", "Fresh content is easy to find."],
  ["Wisdom", "Bilingual", "English and Hindi wisdom support", "Complete", "Quote language follows the selected app language.", "Devotees get wisdom in their chosen language."],
  ["Wisdom", "Sharing", "Share button on each quote", "Complete", "Quote sharing includes the quote text and app link.", "Users can share Sadguru wisdom through phone apps."],
  ["Wisdom", "Library count", "Wisdom page shows loaded quote count", "Complete", "Shows how many quotes are available.", "Admin can verify content is reaching the app."],
  ["More", "Modules", "Shop, Events, Guru Gallery, and Jigyasa", "Complete", "Coming soon modules are placed inside More.", "Future features are visible without cluttering core tabs."],
  ["More", "Logout", "Logout with confirmation", "Complete", "Logout returns user to the sign-in flow.", "Shared devices can be signed out cleanly."],
  ["Admin", "Separate URL", "Admin page moved to separate route", "Complete", "Admin is accessed through the admin URL only.", "Normal users do not see admin tools in More."],
  ["Admin", "Quotes", "Add bilingual wisdom quotes", "Complete", "Admin can enter English and Hindi quote text and attribution.", "Spiritual content can be updated manually."],
  ["Admin", "Edit", "Edit existing wisdom quotes", "Complete", "Already uploaded quotes can be edited.", "Mistakes can be corrected without database work."],
  ["Admin", "Activity", "User activity dashboard", "Complete", "Admin can view user activity in chart and text form.", "Routine adoption can be monitored."],
  ["Backend", "Firebase Auth", "Authentication backend", "Complete", "Firebase Auth is used for Google and phone login.", "The app has real account-based access."],
  ["Backend", "Firebase Database", "Realtime data storage", "Complete", "Users, quotes, routines, and activity are stored in Firebase Realtime Database.", "Admin changes can appear dynamically in the app."],
  ["Build", "Android", "Release APK created", "Complete", "Latest Android APK is ready for install and sharing.", "The app can be tested on Android devices."],
  ["Build", "Web", "GitHub Pages web app deployed", "Complete", "Live web app is deployed for browser review.", "The work can be shared with the team instantly."],
  ["Build", "iOS", "iOS files prepared", "Ready", "iOS project files are ready for Mac or cloud compilation.", "The next step can happen on Mac/cloud without rebuilding from scratch."],
];

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

function styleRange(range, config) {
  range.format = config;
}

function setWidth(sheet, col, width) {
  sheet.getRange(`${col}1:${col}120`).format.columnWidth = width;
}

function setHeight(sheet, row, height) {
  sheet.getRange(`A${row}:H${row}`).format.rowHeight = height;
}

const tech = workbook.worksheets.getItem("Technical Development");
tech.showGridLines = false;
tech.getRange("A1:E1").merge();
tech.getRange("A1").values = [["Guru Vandan Technical Development Roadmap"]];
styleRange(tech.getRange("A1:E1"), {
  fill: deepCrimson,
  font: { bold: true, color: "#FFFFFF", size: 14 },
  horizontalAlignment: "center",
});
tech.getRange("A2:E13").format.borders = { preset: "all", style: "thin", color: line };
styleRange(tech.getRange("A2:E2"), {
  fill: crimson,
  font: { bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
});
styleRange(tech.getRange("A3:A13"), {
  fill: paleRose,
  font: { bold: true, color: deepCrimson },
  horizontalAlignment: "center",
});
tech.getRange("A3:B13").values = versionZeroMilestones;
styleRange(tech.getRange("B3:B13"), {
  fill: offWhite,
  font: { color: ink },
  wrapText: true,
  verticalAlignment: "top",
});
styleRange(tech.getRange("C3:E13"), {
  fill: "#FFFFFF",
  font: { color: ink },
  wrapText: true,
});
setWidth(tech, "A", 12);
setWidth(tech, "B", 52);
setWidth(tech, "C", 22);
setWidth(tech, "D", 22);
setWidth(tech, "E", 22);
for (let row = 3; row <= 13; row += 1) {
  setHeight(tech, row, 44);
}
tech.freezePanes.freezeRows(2);

const detail = workbook.worksheets.getOrAdd("Version 0 Details");
detail.deleteAllDrawings();
detail.showGridLines = false;
detail.getRange("A1:F90").clear({ applyTo: "all" });

detail.getRange("A1:F1").merge();
detail.getRange("A1").values = [["Guru Vandan - Version 0 Feature Tracker"]];
styleRange(detail.getRange("A1:F1"), {
  fill: deepCrimson,
  font: { bold: true, color: "#FFFFFF", size: 16 },
  horizontalAlignment: "center",
});

detail.getRange("A2:F2").merge();
detail.getRange("A2").values = [["Everything listed here was completed or prepared in Version 0 of the Guruvandan app."]];
styleRange(detail.getRange("A2:F2"), {
  fill: offWhite,
  font: { italic: true, color: muted },
  horizontalAlignment: "center",
});

detail.getRange("A4:B6").values = [
  ["Version", "Version 0"],
  ["Status", "Release-ready"],
  ["Last updated", new Date("2026-08-12T00:00:00")],
];
detail.getRange("D4:E6").values = [
  ["Total items", null],
  ["Completed", null],
  ["Prepared", null],
];
detail.getRange("E4").formulas = [[`=COUNTA(C9:C${features.length + 8})`]];
detail.getRange("E5").formulas = [[`=COUNTIF(D9:D${features.length + 8},"Complete")`]];
detail.getRange("E6").formulas = [[`=COUNTIF(D9:D${features.length + 8},"Ready")`]];
styleRange(detail.getRange("A4:E6"), {
  fill: "#FFFFFF",
  font: { color: ink },
  borders: { preset: "all", style: "thin", color: line },
});
styleRange(detail.getRange("A4:A6"), {
  fill: paleRose,
  font: { bold: true, color: deepCrimson },
});
styleRange(detail.getRange("D4:D6"), {
  fill: paleRose,
  font: { bold: true, color: deepCrimson },
});
detail.getRange("B6").format.numberFormat = "yyyy-mm-dd";
detail.getRange("E4:E6").format.numberFormat = "#,##0";

detail.getRange("A8:F8").values = [["Category", "Area", "Feature", "Status", "Implementation notes", "User benefit"]];
styleRange(detail.getRange("A8:F8"), {
  fill: crimson,
  font: { bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
});
detail.getRange(`A9:F${features.length + 8}`).values = features;
styleRange(detail.getRange(`A9:F${features.length + 8}`), {
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
styleRange(detail.getRange(`A9:A${features.length + 8}`), {
  fill: offWhite,
  font: { bold: true, color: deepCrimson, size: 10 },
});
styleRange(detail.getRange(`D9:D${features.length + 8}`), {
  fill: successFill,
  font: { bold: true, color: successText, size: 10 },
  horizontalAlignment: "center",
});
detail.getRange(`D${features.length + 8}`).format = {
  fill: "#FFF4D8",
  font: { bold: true, color: "#936116", size: 10 },
  horizontalAlignment: "center",
};
detail.getRange(`D9:D${features.length + 8}`).dataValidation = {
  rule: { type: "list", values: ["Complete", "Ready", "Planned", "Blocked"] },
};

setWidth(detail, "A", 18);
setWidth(detail, "B", 20);
setWidth(detail, "C", 34);
setWidth(detail, "D", 14);
setWidth(detail, "E", 54);
setWidth(detail, "F", 44);
for (let row = 9; row <= features.length + 8; row += 1) {
  setHeight(detail, row, 46);
}
detail.freezePanes.freezeRows(8);

const master = workbook.worksheets.getItem("Master");
master.showGridLines = false;
master.getRange("A3:B12").values = [
  [
    "Problem statements",
    "1. It is difficult to maintain a daily routine of meditation and satsang, especially when not being in frequent touch with ashrams.\n2. There is no one-stop platform for knowing about all the events happening in our spiritual school.\n3. It is difficult to get access to and comprehend Gurumaharaj's literature.\n4. New generations are not able to understand the value of Gurumaharaj's teachings and research, hence they do not follow or participate in it.",
  ],
  [null, null],
  ["Vision", "To preserve Gurumaharaj's legacy and pass his teachings on to future generations."],
  [
    "Mission",
    "To use technology in our spiritual school to help disciples stay regular in meditation and satsang, remain aware, connected, and actively involved.",
  ],
  [
    "Problem Statements",
    "1. It is difficult to follow a daily routine of meditation and satsang, especially when we are not regularly connected with the ashrams.\n2. There is no single platform where disciples can find information about all the events and activities happening in our spiritual school.\n3. Gurumaharaj's literature can be difficult to access, read, and understand.\n4. The younger generation often does not fully understand the importance of Gurumaharaj's teachings and research, which leads to less participation and connection with the spiritual tradition.\n5. To make Gurumaharaj's teachings more relevant and meaningful to the younger generation by showing how they can be useful in today's world.",
  ],
  [null, null],
  ["Team", "Technical development: Ajay Bhatnagar\nDigital Marketing: Ayushi & Vaishnav Bhatnagar\nProduct Management: Tejaswini Venkata\n"],
  [null, null],
  ["Application", "Guru Vandan"],
  ["First Beta Launch", 46249],
];
master.getRange("A14:B17").values = [
  ["Version 0 Summary", "Flutter app with authentication, satsang, aarti, meditation, streaks, bilingual wisdom, admin tools, Android APK, web app, and iOS-ready files."],
  ["Live Web App", "https://ajaybhatnagar1712.github.io/Guru-vandan/"],
  ["Admin URL", "https://ajaybhatnagar1712.github.io/Guru-vandan/#/admin"],
  ["Latest APK", "D:/DCAM/Guruvandan app/Guru-Vandan-1.0.10+11.apk"],
];
styleRange(master.getRange("A14:A17"), {
  fill: paleRose,
  font: { bold: true, color: deepCrimson },
});
styleRange(master.getRange("B14:B17"), {
  fill: offWhite,
  font: { color: ink },
  wrapText: true,
});
master.getRange("A14:B17").format.borders = { preset: "all", style: "thin", color: line };
master.getRange("A1:A17").format.columnWidth = 24;
master.getRange("B1:B17").format.columnWidth = 118;
styleRange(master.getRange("B3:B17"), {
  fill: "#FFFFFF",
  font: { color: ink },
  wrapText: true,
  verticalAlignment: "top",
});
styleRange(master.getRange("A3:A17"), {
  font: { bold: true, color: ink },
  verticalAlignment: "top",
});
master.getRange("B14:B17").format = {
  fill: offWhite,
  font: { color: ink },
  wrapText: true,
  verticalAlignment: "top",
};
master.getRange("A14:A17").format = {
  fill: paleRose,
  font: { bold: true, color: deepCrimson },
  verticalAlignment: "top",
};
master.getRange("A14:B17").format.borders = { preset: "all", style: "thin", color: line };
master.getRange("A3:B3").format.rowHeight = 96;
master.getRange("A7:B7").format.rowHeight = 132;
master.getRange("A9:B9").format.rowHeight = 58;
master.getRange("A14:B17").format.rowHeight = 34;
master.getRange("B12").format.numberFormat = "mmmm d, yyyy";

const marketing = workbook.worksheets.getItem("Marketing");
marketing.showGridLines = false;
marketing.getRange("A1:C1").merge();
marketing.getRange("A1").values = [["Guru Vandan Marketing Tracker"]];
styleRange(marketing.getRange("A1:C1"), {
  fill: deepCrimson,
  font: { bold: true, color: "#FFFFFF", size: 14 },
  horizontalAlignment: "center",
});
styleRange(marketing.getRange("A3:C3"), {
  fill: crimson,
  font: { bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
});
marketing.getRange("A3:C6").format.borders = { preset: "all", style: "thin", color: line };
marketing.getRange("A1:C6").format.autofitColumns();

const errorScan = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 200 },
  summary: "formula error scan",
});
console.log("FORMULA ERROR SCAN");
console.log(errorScan.ndjson);

const techPreview = await workbook.render({
  sheetName: "Technical Development",
  range: "A1:E13",
  scale: 2,
  format: "png",
});
await fs.writeFile(`${outputDir}/preview_final_technical.png`, new Uint8Array(await techPreview.arrayBuffer()));

const detailPreview = await workbook.render({
  sheetName: "Version 0 Details",
  range: "A1:F24",
  scale: 2,
  format: "png",
});
await fs.writeFile(`${outputDir}/preview_final_details_top.png`, new Uint8Array(await detailPreview.arrayBuffer()));

const detailMidPreview = await workbook.render({
  sheetName: "Version 0 Details",
  range: "A24:F55",
  scale: 2,
  format: "png",
});
await fs.writeFile(`${outputDir}/preview_final_details_rest.png`, new Uint8Array(await detailMidPreview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
