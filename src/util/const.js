export const DimEnum = Object.freeze({
  '2d': '2d',
  '3d': '3d',
  'ar': 'ar',
  'vr': 'vr',
});

export const GraphKindEnum = Object.freeze({
  tree: 'tree',
  web: 'web',
});

export const FilterEnum = Object.freeze({
  nodes: 'nodes',
  links: 'links',
});

export const NodeKindEnum = Object.freeze({
  doc: 'doc',
  media: 'media',
  template: 'template',
  zombie: 'zombie',
});

export const LinkKindEnum = Object.freeze({
  fam: 'fam',
  attr: 'attr',
  link: 'link',
  embed: 'embed',
});

export const CtrlEnum = Object.freeze({
  // graph properties
  kind: 'kind',
  dim: 'dim',
  filter: 'filter',
  fix: 'fix',
  flip: 'flip', // corresponds to tree's 'flip' button
  follow: 'follow',
  glow: 'glow',
  autosync: 'autosync',
  // graph actions
  click: 'click',
  drag: 'drag',
  hover: 'hover',
  select: 'select',
  data: 'data',
  save: 'save',
  sync: 'sync',
});
