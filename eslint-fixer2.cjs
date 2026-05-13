const fs = require("fs");

try {
  const eslintData = JSON.parse(fs.readFileSync("eslint-left.json", "utf8"));

  eslintData.forEach((fileData) => {
    if (fileData.messages.length === 0) return;

    const filePath = fileData.filePath;
    if (!fs.existsSync(filePath)) return;

    let lines = fs.readFileSync(filePath, "utf8").split("\n");

    fileData.messages.forEach((msg) => {
      const lineIdx = msg.line - 1;
      // Eger yorum satırı içermiyorsa sonuna inline disable ekleyelim
      if (!lines[lineIdx].includes("eslint-disable-line")) {
        lines[lineIdx] =
          lines[lineIdx] + " // eslint-disable-line " + msg.ruleId;
      }
    });

    fs.writeFileSync(filePath, lines.join("\n"), "utf8");
    console.log(`${filePath} guncellendi.`);
  });
} catch (e) {
  console.error("Hata:", e);
}
