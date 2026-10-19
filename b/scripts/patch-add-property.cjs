const fs = require("fs");
const paths = [
  "artifacts/trustkeyper/src/pages/AddProperty.tsx",
  "artifacts/trustkeyper/src/pages/AddProperty2.tsx",
];

for (const rel of paths) {
  const p = rel.replace(/\//g, require("path").sep);
  let t = fs.readFileSync(p, "utf8");
  t = t.replace(/\/\/ ─── Progress Bar ───[\s\S]*?\/\/ ─── Reusable UI/g, "// ─── Reusable UI");
  if (!t.includes("useScrollToTopOnChange(subStep)")) {
    t = t.replace(
      "const [subStep, setSubStep] = useState(savedData?.subStep ?? 0);",
      "const [subStep, setSubStep] = useState(savedData?.subStep ?? 0);\n  useScrollToTopOnChange(subStep);",
    );
  }
  t = t.replace(/Tell us more about your property/g, "Tell us more about the property");
  t = t.replace(/Direction of main door/g, "Facing");
  const guard =
    "    if (!getActiveSession()) {\n      toast({ title: \"Please sign in to save properties\", variant: \"destructive\" });\n      setLocation(\"/login\");\n      return;\n    }\n";
  if (!t.includes("Please sign in to save properties")) {
    t = t.replace("  const handleSubmit = () => {\n", `  const handleSubmit = () => {\n${guard}`);
  }
  if (rel.includes("AddProperty2") && !t.includes("AddPropertyProgressBar")) {
    t = t.replace(
      'import BrokerLayout from "@/components/BrokerLayout";',
      'import BrokerLayout from "@/components/BrokerLayout";\nimport { AddPropertyProgressBar } from "@/components/AddPropertyProgressBar";\nimport { useScrollToTopOnChange } from "@/hooks/useScrollToTopOnChange";\nimport { getActiveSession } from "@/lib/auth";\nimport { toast } from "@/hooks/use-toast";',
    );
  }
  fs.writeFileSync(p, t);
  console.log("patched", rel, !t.includes("function ProgressBar"));
}
