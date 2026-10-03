import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ChatAdmin maps server validation to a human message and a field marker", async () => {
  const source = await readFile("src/app/chatadmin/ChatAdminClient.tsx", "utf8");
  assert.match(source, /invalid_writing_style:\{field:"writing_style",message:"Schreibstil/);
  assert.match(source, /setInvalidField\(validation\.field\)/);
  assert.match(source, /data-invalid-field=\{invalidField\?\?undefined\}/);
  assert.match(source, /role="alert"/);
  assert.match(source, /invalid_bio:\{field:"bio",message:"Bio muss ausgefüllt sein und darf höchstens 4\.000 Zeichen enthalten\."/);
  assert.match(source, /payload_too_large:\{field:null,message:"Die Character-Daten sind insgesamt zu lang\./);
  const characterSave = source.slice(source.indexOf(" async function save("), source.indexOf(" async function deactivate("));
  assert.ok(characterSave.length > 0);
  assert.doesNotMatch(characterSave, /Speichern abgewiesen: \$\{body\.error\}/);
});

test("ChatAdmin validation styles mark every character input class in red", async () => {
  const [layout, css] = await Promise.all([
    readFile("src/app/chatadmin/layout.tsx", "utf8"),
    readFile("src/app/chatadmin/validation.module.css", "utf8"),
  ]);
  assert.match(layout, /validation\.module\.css/);
  for (const field of [
    "display_name","public_age","bio","languages","profile_image_path","personality",
    "writing_style","emoji_style","sentence_style","typical_phrases","forbidden_phrases",
    "example_messages","flirt_style","sales_rules",
  ]) {
    assert.match(css, new RegExp(`data-invalid-field="${field}"`));
  }
  assert.match(css, /#fb7185/);
  assert.match(css, /\[role="alert"\]/);
});
