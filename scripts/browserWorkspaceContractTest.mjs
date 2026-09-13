import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import JSZip from 'jszip';
const temporary = await mkdtemp(join(tmpdir(), 'elysia-browser-workspace-'));
try {
  const result = await build({ entryPoints: ['src/shared/codev/workspace.ts'], bundle: true, platform: 'node', format: 'cjs', write: false });
  const target = join(temporary, 'workspace.cjs');
  await writeFile(target, result.outputFiles[0].contents);
  const { BrowserWorkspace, WorkspaceConflict, browserHash, browserWorkspaceHash } = createRequire(import.meta.url)(target);
  const owner = { accountId: 'account-A', browserId: 'browser-fixture', surface: 'forge', draftId: 'draft-A' };
  const license = 'Copyright Example Contributors\n\nPermission is granted to use this synthetic test material.\n\nTHE MATERIAL IS PROVIDED WITHOUT WARRANTY.\n';
  const binary = new Uint8Array([0, 255, 128, 4, 17]);
  const manifest = JSON.stringify({ schema_version: '1.1', name: 'Fixture', version: '1.0.0', signing: { signature: null }, checksums: { files: {} } });
  const initial = () => [
    { path: 'manifest.json', text: manifest, provenance: 'remote_draft' },
    { path: 'README.md', text: '# Fixture\r\nNo source execution.\r\n', provenance: 'intake' },
    { path: 'LICENSE', text: license, provenance: 'intake' },
    { path: 'src/main.py', text: 'answer = 1', provenance: 'intake' },
    { path: 'assets/data.bin', bytes: binary, provenance: 'intake' },
    { path: 'NOTICE', text: 'This file has no final newline.', provenance: 'intake' },
  ];
  const workspace = new BrowserWorkspace(owner, 'Fixture', initial());
  const base = await workspace.capture();
  binary[0] = 99;
  workspace.updateText('src/main.py', 'answer = 2\n');
  assert.equal(workspace.getSnapshot().revision, 1);
  assert.equal(workspace.getSnapshot().dirty, true);
  assert.equal((await workspace.capture()).baseHash, base.contentHash);
  const packaged = await workspace.preparePackage('fixture');
  assert.equal(packaged.snapshot.revision, workspace.getSnapshot().revision);
  const zip = await JSZip.loadAsync(await packaged.file.arrayBuffer());
  for (const file of packaged.snapshot.files) {
    assert.equal(await browserHash(await zip.file(file.path).async('uint8array')), file.content_hash, file.path);
  }
  assert.deepEqual([...await zip.file('assets/data.bin').async('uint8array')], [0,255,128,4,17]);
  assert.equal(await zip.file('LICENSE').async('string'), license);
  assert.equal(await zip.file('README.md').async('string'), '# Fixture\r\nNo source execution.\r\n');
  assert.equal(await zip.file('src/main.py').async('string'), 'answer = 2\n');
  const checksums = JSON.parse(await zip.file('checksums.json').async('string'));
  const actualManifest = JSON.parse(await zip.file('manifest.json').async('string'));
  assert.equal(actualManifest.version, '1.0.0');
  for (const [path, digest] of Object.entries(checksums.files)) assert.equal(await browserHash(await zip.file(path).async('uint8array')), digest);
  assert.equal(actualManifest.checksums.files['checksums.json'], await browserHash(await zip.file('checksums.json').async('uint8array')));
  const repeated = await workspace.preparePackage('fixture');
  assert.equal(repeated.packageHash, packaged.packageHash, 'unchanged export must have deterministic bytes');
  const current = await workspace.capture();
  workspace.markValidated(current.revision);
  workspace.markSaved(current.revision);
  assert.equal(workspace.getSnapshot().dirty, false);
  const nextText = 'answer = 3\n';
  const patch = { planId: 'plan-fixture', revision: current.revision, contentHash: current.contentHash, owner,
    explicitlyApproved: true, changes: [{ path: 'src/main.py', baseHash: current.files.find(file=>file.path==='src/main.py').content_hash, newHash: await browserHash(new TextEncoder().encode(nextText)), text: nextText }] };
  await assert.rejects(workspace.applyReviewedPatch({ ...patch, owner: {...owner,accountId:'account-B'} }), WorkspaceConflict);
  await assert.rejects(workspace.applyReviewedPatch({ ...patch, explicitlyApproved:false }));
  await workspace.applyReviewedPatch(patch);
  assert.equal(workspace.getSnapshot().revision,current.revision+1);
  assert.equal(workspace.getSnapshot().validationRevision,null);
  assert.equal(workspace.getSnapshot().packageRevision,null);
  assert.equal(workspace.getSnapshot().dirty,true);
  await assert.rejects(workspace.applyReviewedPatch(patch),WorkspaceConflict);
  const recovery=await workspace.recovery();
  const restored=await BrowserWorkspace.restore(owner,recovery);
  assert.equal((await restored.capture()).contentHash,(await workspace.capture()).contentHash);
  assert.equal((await restored.capture()).baseHash,base.contentHash);
  assert.equal(restored.getSnapshot().validationRevision,null);
  await assert.rejects(BrowserWorkspace.restore({...owner,draftId:'other'},recovery),WorkspaceConflict);
  const corrupted=structuredClone(recovery);corrupted.files.find(file=>file.path==='LICENSE').bytes[0]=0;
  await assert.rejects(BrowserWorkspace.restore(owner,corrupted),WorkspaceConflict);
  const stale=workspace.getSnapshot().revision;
  workspace.updateText('src/main.py','answer = 4');
  assert.throws(()=>workspace.markSaved(stale),WorkspaceConflict);
  for(const path of ['../escape.py','/absolute.py','folder\\path.py','.env','.ssh/key','CON','two//parts','e\u0301.py']) {
    assert.throws(()=>new BrowserWorkspace(owner,'Unsafe',[{path,text:'x',provenance:'intake'}]),path);
  }
  assert.throws(()=>new BrowserWorkspace(owner,'Collision',[{path:'A.py',text:'x',provenance:'intake'},{path:'a.py',text:'x',provenance:'intake'}]));
  const incomplete=new BrowserWorkspace(owner,'Metadata',[{path:'manifest.json',text:manifest,provenance:'remote_draft'},{path:'missing.bin',sizeBytes:100,provenance:'intake'}]);
  await assert.rejects(incomplete.preparePackage('incomplete'),/available/);
  const privateWorkspace=new BrowserWorkspace(owner,'Private',[{path:'manifest.json',text:manifest,provenance:'remote_draft'},{path:'main.py',text:'token = "ghp_SYNTHETICfixture"',provenance:'intake'}]);
  await assert.rejects(privateWorkspace.recovery(),/secret/);
  await assert.rejects(privateWorkspace.preparePackage('private'),/safe/);
  const text='hello\n'; const bytes=new TextEncoder().encode(text);
  const hash=await browserWorkspaceHash([{path:'a.txt',text,content_hash:await browserHash(bytes),size_bytes:bytes.length,availability:'text',provenance:'editor'}]);
  assert.equal(hash,'49677bb2f70e70704708616672d8bc42f40408ff0389074ab0204c3daee7e1f6','Python/TypeScript shared hash vector');
  restored.dispose(); await assert.rejects(restored.capture(),WorkspaceConflict);
  console.log('PASS: revision-correct packages preserve source/binary/full LICENSE bytes; exact CAS patches, replay, owner isolation, recovery integrity, deterministic checksums, stale results and safety refusals.');
} finally { await rm(temporary,{recursive:true,force:true}); }
