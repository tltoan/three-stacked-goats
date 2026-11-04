// Procedural material study of the user's leather reference. No photographs are
// baked into the model: color and microstructure remain adjustable in every pose.
const PALETTES = {
  brown: { outer: '#50352d', inner: '#985638', edge: '#533022', cord: '#80512f' },
  black: { outer: '#1b1c1b', inner: '#49433a', edge: '#292620', cord: '#1b1c1b' },
  olive: { outer: '#39412b', inner: '#6c7048', edge: '#3c4029', cord: '#39412b' },
};

function seeded(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
function canvas(width, height = width) {
  const image = document.createElement('canvas'); image.width = width; image.height = height;
  return image;
}
function field(size, random) {
  const values = new Float32Array(size * size);
  for (let i = 0; i < values.length; i++) values[i] = random();
  return (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    let tx = x - x0, ty = y - y0;
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    const xx = ((x0 % size) + size) % size, yy = ((y0 % size) + size) % size;
    const xa = (xx + 1) % size, ya = (yy + 1) % size;
    const a = values[yy * size + xx], b = values[yy * size + xa];
    const c = values[ya * size + xx], d = values[ya * size + xa];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}
function pixel(data, index, value, warmth = 0) {
  data[index] = value + warmth; data[index + 1] = value;
  data[index + 2] = value - warmth; data[index + 3] = 255;
}

function makeOuterTextures() {
  // Use a stochastic, floating-point micro-height field rather than interpolated
  // square noise cells. Baking the derivatives before quantization prevents the
  // blocky, stair-stepped highlights produced by an 8-bit bump texture.
  const width = 2048, height = 1408, count = width * height;
  const random = seeded(5377), grain = new Float32Array(count), scratch = new Float32Array(count);
  for (let i = 0; i < count; i++) grain[i] = (random() + random() + random() - 1.5) * .12;
  function soften(source, target, centerWeight = 2) {
    const divisor = centerWeight + 2;
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        target[row + x] = (source[row + (x + width - 1) % width] + centerWeight * source[row + x] + source[row + (x + 1) % width]) / divisor;
      }
    }
    for (let y = 0; y < height; y++) {
      const row = y * width, previous = ((y + height - 1) % height) * width, next = ((y + 1) % height) * width;
      for (let x = 0; x < width; x++) source[row + x] = (target[previous + x] + centerWeight * target[row + x] + target[next + x]) / divisor;
    }
  }
  // Two compact convolutions eliminate isolated white-noise pixels while keeping
  // the entire structure microscopic. There is no repeating cell lattice.
  soften(grain, scratch, 2); soften(grain, scratch, 3);
  function indent(cx, cy, radius, depth, stretch = 1, angle = 0) {
    const reach = Math.ceil(radius * Math.max(stretch, 1) * 2);
    const cos = Math.cos(angle), sin = Math.sin(angle), r2 = radius * radius;
    for (let oy = -reach; oy <= reach; oy++) for (let ox = -reach; ox <= reach; ox++) {
      const xx = Math.floor(cx) + ox, yy = Math.floor(cy) + oy;
      const dx = xx - cx, dy = yy - cy;
      const u = (dx * cos + dy * sin) / stretch, v = -dx * sin + dy * cos;
      const distance = (u * u + v * v) / r2;
      if (distance > 4) continue;
      const x = (xx + width) % width, y = (yy + height) % height;
      grain[y * width + x] -= Math.exp(-distance * 1.8) * depth;
    }
  }
  // Random fine follicle impressions, never an evenly spaced pebble pattern.
  for (let i = 0; i < 43000; i++) {
    indent(random() * width, random() * height, .55 + random() * 1.25,
      .011 + random() * .031, 1 + random() * .45, random() * Math.PI);
  }
  // Very short, shallow grain creases cross the fine pores. Their changing
  // orientation and irregular spacing are visible chiefly inside the softbox.
  for (let i = 0; i < 4700; i++) {
    const x = random() * width, y = random() * height, angle = random() * Math.PI * 2;
    const length = 4 + random() * 21, bend = (random() - .5) * 3.5;
    const steps = Math.ceil(length / 1.8), depth = .006 + random() * .012;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    for (let step = 0; step <= steps; step++) {
      const t = step / steps, side = Math.sin(t * Math.PI) * bend;
      indent(x + cos * length * t - sin * side, y + sin * length * t + cos * side,
        .55 + random() * .28, depth * Math.sin(Math.PI * (.05 + t * .9)));
    }
  }
  // Antialias the subpixel impressions before deriving smooth tangent normals.
  soften(grain, scratch, 5);
  const albedo = canvas(width, height), normal = canvas(width, height), roughness = canvas(width, height);
  const ac = albedo.getContext('2d'), nc = normal.getContext('2d'), rc = roughness.getContext('2d');
  const a = ac.createImageData(width, height), n = nc.createImageData(width, height), r = rc.createImageData(width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const row = y * width, at = row + x, p = at * 4;
    const left = row + (x + width - 1) % width, right = row + (x + 1) % width;
    const up = ((y + height - 1) % height) * width + x, down = ((y + 1) % height) * width + x;
    const dx = (grain[right] - grain[left]) * 4.7;
    const dy = (grain[down] - grain[up]) * 4.7;
    const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
    n.data[p] = 127.5 - dx * inverseLength * 127.5;
    n.data[p + 1] = 127.5 + dy * inverseLength * 127.5;
    n.data[p + 2] = 127.5 + inverseLength * 127.5; n.data[p + 3] = 255;
    // Fine grain modulates reflectance slightly; it must not paint cloudy patches
    // or square blocks into the dark, polished surface.
    pixel(a.data, p, 232 + grain[at] * 30 + (random() - .5) * 1.8, 1);
    pixel(r.data, p, 225 + grain[at] * 110 + (random() - .5) * 2);
  }
  ac.putImageData(a, 0, 0); nc.putImageData(n, 0, 0); rc.putImageData(r, 0, 0);
  // A few restrained, non-repeating wear marks come from the reference's patina.
  for (let i = 0; i < 34; i++) {
    const x = 60 + random() * (width - 120), y = 60 + random() * (height - 120);
    const length = 17 + random() * 70, angle = -.9 + random() * 1.8;
    const ex = x + Math.cos(angle) * length, ey = y + Math.sin(angle) * length;
    ac.strokeStyle = `rgba(255,224,184,${.018 + random() * .035})`;
    ac.lineWidth = .7 + random() * .8;
    ac.beginPath(); ac.moveTo(x, y); ac.quadraticCurveTo(x + length * .4, y - 2 + random() * 4, ex, ey); ac.stroke();
    rc.strokeStyle = 'rgba(255,255,255,.04)'; rc.lineWidth = 1.4;
    rc.beginPath(); rc.moveTo(x, y); rc.lineTo(ex, ey); rc.stroke();
  }
  return { albedo, normal, roughness };
}

function makeSuedeTextures() {
  const size = 1024, random = seeded(5374), albedo = canvas(size), height = canvas(size);
  const ac = albedo.getContext('2d'), hc = height.getContext('2d');
  const a = ac.createImageData(size, size), h = hc.createImageData(size, size);
  const broad = field(32, random), fine = field(128, random);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4, noise = random() - .5;
    const m = broad(x / 36, y / 43) - .5, nap = fine(x / 5, y / 5) - .5;
    pixel(a.data, i, 210 + m * 28 + nap * 28 + noise * 48, 2);
    pixel(h.data, i, 120 + nap * 60 + noise * 96);
  }
  ac.putImageData(a, 0, 0); hc.putImageData(h, 0, 0);
  // Broken fibers with changing direction make this distinct from smooth grain.
  for (let i = 0; i < 62000; i++) {
    const x = random() * size, y = random() * size, angle = random() * Math.PI * 2;
    const length = .5 + random() * 3.8, dark = random() > .48;
    ac.strokeStyle = dark ? 'rgba(30,24,18,.075)' : 'rgba(255,249,233,.13)';
    ac.lineWidth = .45 + random() * .45;
    ac.beginPath(); ac.moveTo(x, y); ac.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length); ac.stroke();
    hc.strokeStyle = dark ? 'rgba(10,10,10,.22)' : 'rgba(255,255,255,.3)';
    hc.lineWidth = .6;
    hc.beginPath(); hc.moveTo(x, y); hc.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length); hc.stroke();
  }
  return { albedo, height };
}

function makePaperTexture() {
  const image = canvas(512), ctx = image.getContext('2d'), random = seeded(806);
  const data = ctx.createImageData(512, 512);
  for (let i = 0; i < data.data.length; i += 4) pixel(data.data, i, 230 + (random() - .5) * 18, 2);
  ctx.putImageData(data, 0, 0);
  ctx.strokeStyle = 'rgba(60,48,30,.035)'; ctx.lineWidth = .4;
  for (let i = 0; i < 6000; i++) {
    const x = random() * 512, y = random() * 512;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + random() * 4, y + random() * 3); ctx.stroke();
  }
  return image;
}

function makeEdgeTexture() {
  const image = canvas(512, 128), ctx = image.getContext('2d'), random = seeded(5382);
  const data = ctx.createImageData(512, 128);
  for (let i = 0; i < data.data.length; i += 4) pixel(data.data, i, 190 + random() * 60);
  ctx.putImageData(data, 0, 0);
  for (let i = 0; i < 9000; i++) {
    const x = random() * 512, y = random() * 128;
    ctx.strokeStyle = i % 2 ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.16)';
    ctx.lineWidth = .3 + random() * .6;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2 + random() * 6, y + (random() - .5) * 2); ctx.stroke();
  }
  return image;
}

function makeCordTexture() {
  const image = canvas(128, 64), ctx = image.getContext('2d');
  ctx.fillStyle = '#c9c6bf'; ctx.fillRect(0, 0, 128, 64);
  for (let i = -128; i < 256; i += 8) {
    ctx.strokeStyle = 'rgba(38,35,27,.17)'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 43, 64); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = .75;
    ctx.beginPath(); ctx.moveTo(i + 2, 0); ctx.lineTo(i + 45, 64); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,35,24,.11)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(i, 64); ctx.lineTo(i + 43, 0); ctx.stroke();
  }
  return image;
}

export function createLeatherMaterials(THREE) {
  const textures = new Set();
  const texture = (image, color = false) => {
    const t = new THREE.CanvasTexture(image);
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 16; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
    textures.add(t); return t;
  };
  const o = makeOuterTextures(), s = makeSuedeTextures();
  const outerNormal = texture(o.normal);
  const outer = new THREE.MeshPhysicalMaterial({
    color: PALETTES.brown.outer,
    map: texture(o.albedo, true), normalMap: outerNormal, normalScale: new THREE.Vector2(.72, .72),
    roughness: .44, roughnessMap: texture(o.roughness), metalness: 0,
    ior: 1.46, specularIntensity: .8,
    clearcoat: .14, clearcoatRoughness: .43,
    clearcoatNormalMap: outerNormal, clearcoatNormalScale: new THREE.Vector2(.48, .48),
    envMapIntensity: 1.08,
  });
  const inner = new THREE.MeshPhysicalMaterial({
    color: PALETTES.brown.inner,
    map: texture(s.albedo, true), bumpMap: texture(s.height), bumpScale: .023,
    roughness: .98, metalness: 0, specularIntensity: .18,
    sheen: .32, sheenColor: new THREE.Color('#b28d68'), sheenRoughness: .96,
  });
  const edgeImage = makeEdgeTexture();
  const edge = new THREE.MeshStandardMaterial({
    color: PALETTES.brown.edge, map: texture(edgeImage, true),
    bumpMap: texture(edgeImage), bumpScale: .012, roughness: .95,
  });
  const cordImage = makeCordTexture(), cordMap = texture(cordImage, true), cordBump = texture(cordImage);
  cordMap.repeat.set(16, 1); cordBump.repeat.set(16, 1);
  const cord = new THREE.MeshStandardMaterial({
    color: PALETTES.brown.cord, map: cordMap, bumpMap: cordBump, bumpScale: .002,
    roughness: .81, metalness: 0,
  });
  const brass = new THREE.MeshStandardMaterial({ color: '#ad9059', metalness: .83, roughness: .32, envMapIntensity: 1.1 });
  const paperImage = makePaperTexture();
  const kraft = new THREE.MeshStandardMaterial({
    color: '#b29972', map: texture(paperImage, true), bumpMap: texture(paperImage), bumpScale: .003,
    roughness: .98, metalness: 0,
  });
  const materials = [outer, inner, edge, cord, brass, kraft];
  return {
    outer, inner, edge, cord, brass, kraft,
    setColor(name) {
      const p = PALETTES[name] || PALETTES.brown;
      outer.color.set(p.outer); inner.color.set(p.inner); edge.color.set(p.edge); cord.color.set(p.cord);
      inner.sheenColor.set(name === 'brown' ? '#b28d68' : name === 'olive' ? '#92916a' : '#7c796e');
    },
    dispose() { materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); },
  };
}
