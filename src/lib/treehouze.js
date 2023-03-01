'use strict';

// import { forceManyBody, forceX, forceY } from 'd3-force';

import { cloneDeep, merge } from 'lodash';

import * as  AFRAME from 'aframe';

import { CSS2DObject, CSS2DRenderer } from '../patch/three-mod';
import { SelectionBox } from 'three/addons/interactive/SelectionBox.js';

import ForceGraph from 'force-graph';
import ForceGraph3D from '3d-force-graph';
import ForceGraphAR from '3d-force-graph-ar';
import ForceGraphVR from '3d-force-graph-vr';
import elementResizeDetectorMaker from 'element-resize-detector';

import { Pane } from 'tweakpane';

import cond from '../util/chainLogic';
import {
  CtrlEnum,
  DimEnum,
  GraphKindEnum,
  LinkKindEnum,
  NodeKindEnum,
} from '../util/const';


export default class TreeHouze {

  constructor(elementWrap, elementGraph, opts) {
    // cache graph data purpose:
    // - to be able to redraw the graph without needing data to be given again
    // - to save lineage/neighbor ids for redraws
    // - to save fixed node coords
    this.dataCache = {};

    // graph values
    this.graphWrap = elementWrap;   // selection box is appended to this element
    this.graphDiv = elementGraph;   // graph is appended to this div
    this.nodeRadiusDefault = 6;     // node radius / size
    this.directionalParticles = 4;  // number of particles to display on link line
    this.glowShadowBlur = 40;       // 2d 'shadowBlur' property for glow
    this.fallbackColor = '#FFFFFF'; // fallback node color in case kinds/types aren't working

    // option                                custom                         default
    this.dagHeight        = opts.dagHeight      ? opts.dagHeight               : 100;
    this.centerSpeed      = opts.centerSpeed    ? opts.centerSpeed             : 1000;
    this.isCurrentNode    = opts.current        ? opts.current                 : (node) => { return false; };
    // colors
    this.colors           = opts.colors         ? opts.colors                  : {
                                                                                  // graph
                                                                                  background: '#000011',
                                                                                  // node
                                                                                  text      : '#e6e1e8', // node labels
                                                                                  band      : '#44434d', // node band
                                                                                  current   : '#F0C61F', // 'current node'
                                                                                  // link
                                                                                  link      : '#44434d',
                                                                                  particle  : '#959396', // link particles
                                                                                }
    this.nodekinds        = opts.nodekinds      ? opts.nodekinds               : {
                                                                                  doc     : '#3e5c50',
                                                                                  template: '#F8F0E3',
                                                                                  zombie  : '#959DA5',
                                                                                };
    this.nodetypes        = opts.nodetypes      ? opts.nodetypes               : { default: '#3e5c50' };
    // this.linkkinds        = opts.linkkinds      ? opts.linkkinds               : {
    //                                                                             fam  : '',
    //                                                                             attr : '',
    //                                                                             link : '',
    //                                                                             embed: '',
    //                                                                           };
    // this.linktypes        = opts.linktypes      ? opts.linktypes               : { default: '#44434d' };

    // ctrls
    this.enabled          = opts.ctrls.enabled  ? opts.ctrls.enabled           : true;
    this.exclude          = opts.ctrls.exclude  ? opts.ctrls.exclude           : [];
    // graph properties
    this.isAutoSyncActive = opts.ctrls.autosync ? opts.ctrls.autosync          : true;
    this.dim              = opts.ctrls.dim      ? opts.ctrls.dim               : DimEnum['2d'];
    this.isFiltered       = {
      nodes: {
        [NodeKindEnum.doc]: true,
        // [NodeKindEnum.media]: true,
        [NodeKindEnum.template]: true,
        [NodeKindEnum.zombie]: true,
      },
      links: {
        [LinkKindEnum.fam]: true,
        [LinkKindEnum.attr]: true,
        [LinkKindEnum.link]: true,
        [LinkKindEnum.embed]: true,
      }
    };
    this.kind             = opts.ctrls.kind     ? opts.ctrls.kind              : GraphKindEnum.web;
    // graph actions
    this.isClickActive    = opts.ctrls.click    ? opts.ctrls.click             : true;
    this.isDragActive     = opts.ctrls.drag     ? opts.ctrls.drag              : true;
    this.isFixActive      = opts.ctrls.fix      ? opts.ctrls.fix               : true;
    this.isFollowActive   = opts.ctrls.follow   ? opts.ctrls.follow            : true;
    this.isGlowActive     = opts.ctrls.glow     ? opts.ctrls.glow              : true;
    this.isHoverActive    = opts.ctrls.hover    ? opts.ctrls.hover             : true;
    this.isSelectActive   = opts.ctrls.select   ? opts.ctrls.hover             : true;

    // controls
    this.setupCtrls();

    // seems like the y-axis is flipped between 2d and 3d space...not sure why...
    this.flipYAxis = -1;

    // init empty graph
    this.graph = undefined;
  }

  ////
  // ctrls

  setupCtrls(opts = {}) {
    if (!this.enabled) { return; }
    const DEFAULT_CTRLS = {
      // graph properties
      kind: this.kind,
      dim: this.dim,
      filter: this.isFiltered,
      fix: this.isFixActive,
      follow: this.isFollowActive,
      glow: this.isGlowActive,
      autosync: this.isAutoSyncActive,
      // actions
      click: this.isClickActive,
      drag: this.isDragActive,
      hover: this.isHoverActive,
      select: this.isSelectActive,
    };
    const ctrls = merge(DEFAULT_CTRLS, opts);

    // init ctrl pane
    if (this.ctrlPane) {
      this.ctrlPane.dispose();
    }
    // the 'title' key allows the pane to be collapsible
    this.ctrlPane = new Pane({
      title: 'controls',
      expanded: true,
    });
    const tabs = this.ctrlPane.addTab({
      pages: [
        { title: 'properties' },
        { title: 'actions' },
      ],
    });

    ////
    // graph properties
    const tabProperties = tabs.pages[0];
    // kind
    if (!this.exclude.includes(CtrlEnum.kind)) {
      tabProperties.kindInput = tabProperties.addInput(
        ctrls, 'kind',
        {
          options: {
            'tree': GraphKindEnum.tree,
            'web': GraphKindEnum.web,
          }
        }
      );
      tabProperties.kindInput.on('change', (ev) => {
        this.updateKind(ev.value);
        this.draw();
      });
    }
    // dim
    if (!this.exclude.includes(CtrlEnum.dim)) {
      tabProperties.dimInput = tabProperties.addInput(
        ctrls, 'dim',
        {
          options: {
            '2D': DimEnum['2d'],
            '3D': DimEnum['3d'],
            'AR': DimEnum['ar'],
            'VR': DimEnum['vr'],
          }
        }
      );
      tabProperties.dimInput.on('change', (ev) => {
        this.updateDim(ev.value);
        this.draw();
      });
    }
    // fix <-> force
    if (!this.exclude.includes(CtrlEnum.fix)) {
      tabProperties.fixInput = tabProperties.addInput(ctrls, CtrlEnum.fix);
      tabProperties.fixInput.on('change', (ev) => this.updateFixActive(Boolean(ev.value)));
    }
    // follow
    if (!this.exclude.includes(CtrlEnum.follow)) {
      tabProperties.followInput = tabProperties.addInput(ctrls, CtrlEnum.follow);
      tabProperties.followInput.on('change', (ev) => this.updateFollowActive(Boolean(ev.value)));
    }
    // glow
    if (!this.exclude.includes(CtrlEnum.glow)) {
      tabProperties.glowInput = tabProperties.addInput(ctrls, CtrlEnum.glow);
      tabProperties.glowInput.on('change', (ev) => this.updateGlowActive(Boolean(ev.value)));
    }
    // auto-sync
    if (!this.exclude.includes(CtrlEnum.autosync)) {
      tabProperties.autosyncInput = tabProperties.addInput(ctrls, CtrlEnum.autosync);
      tabProperties.autosyncInput.on('change', (ev) => this.updateAutoSyncActive(Boolean(ev.value)));
    }
    // flip (tree on the y-axis)
    if (!this.exclude.includes(CtrlEnum.flip)) {
      tabProperties.flip = tabProperties.addButton({
        title: 'flip',
      });
      tabProperties.flip.on('click', () => this.flip());
      tabProperties.flip.disabled = (this.kind === GraphKindEnum.web);
    }
    // filter
    if (!this.exclude.includes(CtrlEnum.filter)) {
      const folderFilter = tabProperties.addFolder({
        title: 'filter',
        expanded: false,
      });
      // nodes
      folderFilter.addBlade({
        view: 'text',
        label: 'node',
        parse: (v) => String(v),
        value: 'kinds',
        disabled: true,
      });
      folderFilter.filterNodeDocInput = folderFilter.addInput(ctrls.filter.nodes, NodeKindEnum.doc);
      folderFilter.filterNodeDocInput.on('change', (ev) => {
        this.updateFilterNodes(NodeKindEnum.doc, Boolean(ev.value));
        this.draw();
      });
      folderFilter.filterNodeTemplateInput = folderFilter.addInput(ctrls.filter.nodes, NodeKindEnum.template);
      folderFilter.filterNodeTemplateInput.on('change', (ev) => {
        this.updateFilterNodes(NodeKindEnum.template, Boolean(ev.value));
        this.draw();
      });
      folderFilter.filterNodeZombieInput = folderFilter.addInput(ctrls.filter.nodes, NodeKindEnum.zombie);
      folderFilter.filterNodeZombieInput.on('change', (ev) => {
        this.updateFilterNodes(NodeKindEnum.zombie, Boolean(ev.value));
        this.draw();
      });
      folderFilter.addSeparator();
      folderFilter.addBlade({
        view: 'text',
        label: 'link',
        parse: (v) => String(v),
        value: 'kinds',
        disabled: true,
      });
      // links
      // todo: fam
      // folderFilter.filterLinkFamInput = folderFilter.addInput(ctrls.filter.links, LinkKindEnum.fam);
      // folderFilter.filterLinkFamInput.on('change', (ev) => {
      //   this.updateFilterLinks(LinkKindEnum.fam, Boolean(ev.value));
      //   this.draw();
      // });
      // folderFilter.filterLinkFamInput.disabled = (this.kind === KindEnum.web);
      // attr
      folderFilter.filterLinkAttrInput = folderFilter.addInput(ctrls.filter.links, LinkKindEnum.attr);
      folderFilter.filterLinkAttrInput.on('change', (ev) => {
        this.updateFilterLinks(LinkKindEnum.attr, Boolean(ev.value));
        this.draw();
      });
      folderFilter.filterLinkAttrInput.disabled = (this.kind === GraphKindEnum.tree);
      // link
      folderFilter.filterLinkLinkInput = folderFilter.addInput(ctrls.filter.links, LinkKindEnum.link);
      folderFilter.filterLinkLinkInput.on('change', (ev) => {
        this.updateFilterLinks(LinkKindEnum.link, Boolean(ev.value));
        this.draw();
      });
      folderFilter.filterLinkLinkInput.disabled = (this.kind === GraphKindEnum.tree);
      // embed
      folderFilter.filterLinkEmbedInput = folderFilter.addInput(ctrls.filter.links, LinkKindEnum.embed);
      folderFilter.filterLinkEmbedInput.on('change', (ev) => {
        this.updateFilterLinks(LinkKindEnum.embed, Boolean(ev.value));
        this.draw();
      });
      folderFilter.filterLinkEmbedInput.disabled = (this.kind === GraphKindEnum.tree);
      folderFilter.addSeparator();
    }
    ////
    // actions
    const tabActions = tabs.pages[1];
    // click
    if (!this.exclude.includes(CtrlEnum.click)) {
      tabActions.clickInput = tabActions.addInput(ctrls, CtrlEnum.click);
      tabActions.clickInput.on('change', (ev) => this.updateClickActive(Boolean(ev.value)));
    }
    // drag
    if (!this.exclude.includes(CtrlEnum.drag)) {
      tabActions.dragInput = tabActions.addInput(ctrls, CtrlEnum.drag);
      tabActions.dragInput.on('change', (ev) => this.updateDragActive(Boolean(ev.value)));
    }
    // hover
    if (!this.exclude.includes(CtrlEnum.hover)) {
      tabActions.hoverInput = tabActions.addInput(ctrls, CtrlEnum.hover);
      tabActions.hoverInput.on('change', (ev) => this.updateHoverActive(Boolean(ev.value)));
    }
    // select
    if (!this.exclude.includes(CtrlEnum.select)) {
      tabActions.selectInput = tabActions.addInput(ctrls, CtrlEnum.select);
      tabActions.selectInput.on('change', (ev) => this.updateSelectActive(Boolean(ev.value)));
    }
    // data
    if (!this.exclude.includes(CtrlEnum.data)
    && (!this.exclude.includes(CtrlEnum.save)
      || !this.exclude.includes(CtrlEnum.sync))
    ) {
      const folderData = tabActions.addFolder({
        title: 'data',
        expanded: false,
      });
      // sync
      if (!this.exclude.includes(CtrlEnum.sync)){
        folderData.sync = folderData.addButton({
          title: 'sync',
          // label: 'sync',
        });
        folderData.sync.on('click', () => this.sync());
      }
      // save
      if (!this.exclude.includes(CtrlEnum.save)){
        folderData.save = folderData.addButton({
          title: 'save',
          // label: 'save',
        });
        folderData.save.on('click', () => this.save());
      }
    }

    // update ctrl vars
    if (Object.keys(opts).length > 0) {
      this.updateCtrls(opts);
    }
  }

  ////
  // input methods

  updateCtrls(payload) {
    for (let [ctrl, value] of Object.entries(payload)) {
      switch (ctrl) {
      // graph properties
      case CtrlEnum.dim: {
        this.updateDim(value);
        break;
      }
      case CtrlEnum.kind: {
        this.updateKind(value);
        break;
      }
      case CtrlEnum.filter: {
        for (const [kind, boolVal] of Object.entries(value.nodes)) {
          this.updateFilterNodes(kind, boolVal);
        }
        for (const [kind, boolVal] of Object.entries(value.links)) {
          this.updateFilterLinks(kind, boolVal);
        }
        break;
      }
      case CtrlEnum.fix: {
        this.updateFixActive(value);
        break;
      }
      case CtrlEnum.follow: {
        this.updateFollowActive(value);
        break;
      }
      case CtrlEnum.glow: {
        this.updateGlowActive(value);
        break;
      }
      case CtrlEnum.autosync: {
        this.updateAutoSyncActive(value);
        break;
      }
      // graph actions
      case CtrlEnum.click: {
        this.updateClickActive(value);
        break;
      }
      case CtrlEnum.drag: {
        this.updateDragActive(value);
        break;
      }
      case CtrlEnum.hover: {
        this.updateHoverActive(value);
        break;
      }
      case CtrlEnum.select: {
        this.updateSelectActive(value);
        break;
      }
      default: { console.warn(`invalid ctrl: "${ctrl}" with value: "${JSON.stringify(value)}"`); }
      }
    }
  }

  // graph properties

  updateDim(value) {
    if (!Object.values(DimEnum).includes(value)) {
      console.warn(`invalid graph 'dim'ension: ${value}`);
    } else {
      this.dim = value;
    }
  }

  updateKind(value) {
    if (!Object.values(GraphKindEnum).includes(value)) {
      console.warn(`invalid graph 'kind': ${value}`);
    } else {
      this.kind = value;
    }
  }

  updateFixActive(value) {
    this.isFixActive = Boolean(value);
    if (this.hasData()) {
      // restick graph nodes
      for (let node of this.data()['nodes']) {
        if (this.isFixActive) {
          this.restick(node);
          // this.graph.d3Force('center', null);
        } else {
          this.unstick(node);
        }
      }
    }
  }

  updateFollowActive(value) {
    this.isFollowActive = Boolean(value);
  }

  updateGlowActive(value) {
    this.isGlowActive = Boolean(value);
  }

  updateFilterNodes(filter, value) {
    if (!Object.values(NodeKindEnum).includes(filter)) {
      console.warn(`invalid node filter: ${filter}`);
    } else {
      this.isFiltered.nodes[filter] = value;
    }
  }

  updateFilterLinks(filter, value) {
    if (!Object.values(LinkKindEnum).includes(filter)) {
      console.warn(`invalid link filter: ${filter}`);
    } else {
      this.isFiltered.links[filter] = value;
    }
  }

  updateAutoSyncActive(value) {
    this.isAutoSyncActive = Boolean(value);
  }

  // actions

  updateClickActive(value) {
    this.isClickActive = Boolean(value);
  }

  updateDragActive(value) {
    this.isDragActive = Boolean(value);
  }

  updateHoverActive(value) {
    this.isHoverActive = Boolean(value);
    if (!this.isHoverActive) {
      this.highlightNodes.clear();
      this.highlightLinks.clear();
      this.hoverNode = null;
      this.hoverLink = null;
    }
  }

  updateSelectActive(value) {
    this.isSelectActive = Boolean(value);

    if (!this.isSelectActive) {
      this.selectedNodes.clear();
    }
  }

  ////
  // main

  GraphClass() {
    if (this.dim === DimEnum['2d']) {
      return ForceGraph;
    } else if (this.dim === DimEnum['3d']) {
      return ForceGraph3D;
    } else if (this.dim === DimEnum['ar']) {
      return ForceGraphAR;
    } else if (this.dim === DimEnum['vr']) {
      return ForceGraphVR;
    } else {
      console.error("not a valid graph dimension");
    }
  }

  draw(data, opts) {
    // caching
    if (data !== undefined) {
      // save
      this.dataCache = cloneDeep(data);
    } else {
      // retrieve
      data = cloneDeep(this.dataCache);
    }

    // error
    if (!data) {
      console.error('no graph data');
      return;
    }

    // apply any filters (node/link)
    data = this.filter(data);

    // opts
    if (opts) {
      this.nodekinds = cloneDeep(opts.nodekinds);
      this.nodetypes = cloneDeep(opts.nodetypes);
      this.setupCtrls(opts.ctrls);
    }

    // vars
    this.selectedNodes = new Set([]);
    this.highlightNodes = new Set([]);
    this.highlightLinks = new Set([]);
    this.hoverNode = null;
    this.hoverLink = null;

    // todo: for tree kind
    // node height vars
    // this.shifted = [];
    // this.numSiblingsLeft = [];

    // hydrate nodes from node ids
    if (this.is2Dor3D()) {
      if (this.kind === GraphKindEnum.tree) {
        this.prepLineage(data);
      }
      if (this.kind === GraphKindEnum.web) {
        this.prepNeighbors(data);
      }
    }

    ////
    // graph

    const Graph = cond(
      this.GraphClass()({
        extraRenderers: [new CSS2DRenderer()]
      })(this.graphDiv)
        // graph
        .graphData(data)
        .height(this.graphDiv.parentElement.clientHeight)
        .width(this.graphDiv.parentElement.clientWidth)
        // node
        .nodeId('id')
        // link
        .linkSource('source')
        .linkTarget('target')
        // .linkWidth(link => highlightLinks.has(link) ? 4 : 1)
        .linkColor(() => this.colors.link)
      )
      // graph properties
      // web -> tree
      .if(this.kind === GraphKindEnum.tree, g => g
        .dagMode('td')
        .dagLevelDistance(this.dagHeight)
      )
      // 2d
      .if(this.dim === DimEnum['2d'], g => g
        .nodeCanvasObject((node, ctx) => this.nodePaint(node, ctx))
      )
      // 3d / ar / vr
      .if(this.dim !== DimEnum['2d'], g => g
        .nodeThreeObject((node) => this.nodeClay(node))
      )
      // unsupported by 'ar'
      .if(this.dim !== DimEnum['ar'], g => g
        .backgroundColor(this.colors.background)
        .nodeLabel('label')
      )
      // graph (inter)actions
      .if(this.is2Dor3D(), g => g
        .onBackgroundClick((event) => {
          if (this.isSelectActive && !event.shiftKey) {
            this.selectedNodes.clear();
            if (this.dim === DimEnum['3d']) { this.reshape(); }
          }
        })
      )
      .if(this.is2Dor3D(), g => g
        .onNodeClick((node, event) => this.onClickNode(node, event))
      )
      .if(this.is2Dor3D(), g => g
        .onNodeDrag((node, translate) => this.onDragNode(node, translate))
        .onNodeDragEnd((node) => this.onDragEndNode(node))
      )
      .if(this.is2Dor3D(), g => g
        .onNodeHover((node, prevNode) => this.onHoverNode(node, prevNode))
        .onLinkHover((link, prevLink) => this.onHoverLink(link))
        .linkDirectionalParticles(this.directionalParticles)
        .linkDirectionalParticleWidth((link) => this.highlightLinks.has(link) ? 2 : 0)
        .linkDirectionalParticleColor(() => this.colors.particle)
      )
      .end();

    elementResizeDetectorMaker().listenTo(
      this.graphDiv,
      function(el) {
        Graph.width(el.offsetWidth);
        Graph.height(el.offsetHeight);
      }
    );

    // destroy previous graph
    if (this.graph !== undefined) {
      this.graph._destructor();
    }
    // attach new graph
    this.graph = Graph;

    // restick nodes (on redraws)
    if (this.isDragActive && this.isFixActive) {
      for (let node of this.data()['nodes']) {
        this.restick(node);
      }
    }

    ////
    // box selection

    this.selectBox = undefined;
    this.selectStartPoint = undefined;
    // 3d-only
    this.selectTranslator = undefined;
    this.pointTopLeft, this.pointBottomRight = undefined;
    this.cameraPos = undefined;
    this.selectTranslator = undefined;

    if (this.is2Dor3D()) {
      if (this.dim === DimEnum['3d']) {
        // utility to convert between 2d select box coordinates and 3d graph coordinates
        this.selectTranslator = new SelectionBox(this.graph.camera(), this.graph.scene());
      }
      // attach listeners
      this.graphDiv.addEventListener('pointerdown', (e) => this.onSelectStart(e));
      this.graphDiv.addEventListener('pointermove', (e) => this.onSelect(e));
      this.graphDiv.addEventListener('pointerup', (e) => this.onSelectEnd(e));
    }
  }

  // 3d quirk methods

  reshape() {
    // trigger update of highlighted objects in scene
    this.graph.nodeThreeObject(this.graph.nodeThreeObject())
              .linkDirectionalParticles(this.graph.linkDirectionalParticles())
              .linkDirectionalParticleWidth(this.graph.linkDirectionalParticleWidth())
              .linkDirectionalParticleColor(this.graph.linkDirectionalParticleColor());
  }

  ////
  // graph description helper

  is2Dor3D() {
    return /\d+/.test(this.dim);
  }

  ////
  // data

  data() {
    return this.hasData() ? this.graph.graphData() : undefined;
  }

  hasData() {
    return Boolean(this.graph && Object.keys(this.graph).includes('graphData') && this.graph.graphData());
  }

  prepLineage(data) {
    // lineage: replace ids with fully rendered graph objects
    return data.nodes.forEach(node => {
      // lineage
      let lineageNodes = [];
      node.lineage.nodes.forEach(nodeId => {
        lineageNodes.push(data.nodes.find(renderedNode => renderedNode.id === nodeId));
      });
      let lineageLinks = [];
      node.lineage.links.forEach(link => {
        lineageLinks.push(data.links.find(renderedLink => renderedLink.source === link.source && renderedLink.target === link.target));
      });
      node.lineage.nodes = lineageNodes;
      node.lineage.links = lineageLinks;
      // todo: siblings
      // this.numSiblingsLeft[node.parent] = node.siblings.length;
    });
  }

  prepNeighbors(data) {
    // neighbors: replace ids with fully rendered graph objects
    return data.nodes.forEach(node => {
      let neighborNodes = [];
      node.neighbors.nodes.forEach(nodeId => {
        neighborNodes.push(data.nodes.find(renderedNode => renderedNode.id === nodeId));
      });
      let neighborLinks = [];
      node.neighbors.links.forEach(link => {
        neighborLinks.push(data.links.find(renderedLink => renderedLink.source === link.source && renderedLink.target === link.target));
      });
      node.neighbors.nodes = neighborNodes;
      node.neighbors.links = neighborLinks;
    });
  }

  filter(data) {
    let nodeKinds = Object.entries(this.isFiltered.nodes)
                          .filter((item) => item[1] === true)
                          .map((item) => item[0]);
    let linkKinds = Object.entries(this.isFiltered.links)
                          .filter((item) => item[1] === true)
                          .map((item) => item[0]);
    let filteredNodeIds = [];
    data.nodes = data.nodes.filter((node) => {
      if (nodeKinds.includes(node.kind)) {
        return true;
      } else {
        filteredNodeIds.push(node.id);
        return false;
      }
    });
    data.links = data.links.filter((link) => {
      return linkKinds.includes(link.kind) &&
            !filteredNodeIds.includes(link.source) &&
            !filteredNodeIds.includes(link.target)
    });
    return data;
  }

  ////
  // draw helpers

  // 3d

  nodeClay(node) {
    if (!this.isFixActive) {
      this.unstick(node);
    }
    // todo-shift: this shiftNodeHeight() animates more smoothly, but suffers from a race condition
    // if (this.kind === "tree") {
    //   node.fy = this.shiftNodeHeight(node);
    // }
    // prep node vars
    let radius = this.nodeRadiusDefault;
    let alpha = 0.75;
    let labelled = true;
    // 'ar' + 'vr' are choking on "infinite" recursion in 'lineage'/'neighbors'
    let res = this.setHoverNode(node, radius, alpha, labelled);
    radius = res[0];
    alpha = res[1];
    labelled = res[2];
    // calculate color/alpha
    let color = this.setColorNode(node);
    // build threejs object
    // invisible mesh for dragging
    let handleGeometry = new THREE.SphereGeometry(radius, 32, 16);
    let handleMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0
    });
    let handleObj = new THREE.Mesh(handleGeometry, handleMaterial);
    // node
    let nodeGeometry = new THREE.SphereGeometry(radius, 32, 16);
    let nodeMaterial = new THREE.MeshLambertMaterial({
      color: color,
      transparent: true,
      opacity: alpha,
    });
    let nodeObj = new THREE.Mesh(nodeGeometry, nodeMaterial);
    // band
    radius = this.selectedNodes.has(node) ? (radius * (7 / 5)) : radius;
    let bandGeometry = new THREE.TorusGeometry(radius, 1.5, 16, 100);
    let bandMaterial = new THREE.MeshLambertMaterial({
      color: this.colors.band,
      transparent: true,
      opacity: alpha,
    });
    let bandObj = new THREE.Mesh(bandGeometry, bandMaterial);
    // label
    let label = '';
    if (labelled) {
      label = document.createElement('div');
      label.textContent = node.label;
      label.style.color = this.colors.text;
      label.style.opacity = (this.hoverNode || this.hoverLink) ? 1.0 : 0.20;
      // label.style.z = 0;
      handleObj.add(new CSS2DObject(label));
    }
    handleObj.add(nodeObj);
    handleObj.add(bandObj);

    // todo: randomly rotate node so bands are not all facing the same direction
    // handleObj.rotation.x += Math.random();
    // handleObj.rotation.y += Math.random();
    // handleObj.rotation.z += Math.random();

    return handleObj;
  }

  // 2d

  nodePaint(node, ctx) {
    if (!this.isFixActive) {
      this.unstick(node);
    }
    // todo-shift: this shiftNodeHeight() animates more smoothly, but suffers from a race condition
    // if (this.kind === "tree") {
    //   node.fy = this.shiftNodeHeight(node);
    // }
    // prep node vars
    let radius = this.nodeRadiusDefault;
    let alpha = 1.0;
    let labelled = true;
    let res = this.setHoverNode(node, radius, alpha, labelled);
    radius = res[0];
    alpha = res[1];
    labelled = res[2];
    // calculate color/alpha
    let color = this.setColorNode(node);
    // 'ctx' calls are order-dependent
    // alpha set
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
    if (this.isGlowActive) {
      // glow on
      if (this.isCurrentNode(node)) {
        ctx.shadowBlur = this.glowShadowBlur;
        ctx.shadowColor = this.colors.current;
      } else {
        // nodekind
        if (this.nodekinds[node.kind] !== NodeKindEnum.doc) {
          ctx.shadowColor = this.nodekinds[node.kind];
        // nodetype
        } else {
          ctx.shadowColor = this.nodetypes[node.type];
        }
        ctx.shadowBlur = node.state;
      }
    }
    ctx.fill();
    // glow off
    ctx.shadowBlur = 0;
    ctx.shadowColor = "";
    // draw band
    ctx.lineWidth = this.selectedNodes.has(node) ? (radius * (4 / 5)) : (radius * (2 / 5));
    ctx.strokeStyle = this.colors.band;
    ctx.stroke();
    if (labelled) {
      // draw label
      ctx.globalAlpha = (this.hoverNode || this.hoverLink) ? 1.0 : 0.25;
      ctx.fillStyle = this.colors.text;
      ctx.fillText(node.label, node.x + radius + 1, node.y + radius + 1);
    }
    // alpha reset
    ctx.globalAlpha = 1.0;
  }

  // shiftNodeHeight(node) {
        /* node === root */
  //   if (node.title !== 'O' && !this.shifted.includes(node)) {
  //     const padding = 5;
  //     let areSiblingsLeftEven = (this.numSiblingsLeft[node.parent] % 2) === 1;
  //     let altrntr = areSiblingsLeftEven ? 1 : -1;
  //     node.fy = node.fy + (altrntr * (this.numSiblingsLeft[node.parent] * padding));
  //     this.numSiblingsLeft[node.parent] -= 1;
  //     this.shifted.push(node);
  //   }
  // }

  // draw helpers

    setColorNode(node) {
    let color = undefined;
    let kind = undefined;
    let type = undefined;
    const isValidKind = Object.keys(this.nodekinds).includes(node.kind);
    const isValidType = Object.keys(this.nodetypes).includes(node.type);
    const isDocKind = (node.kind === NodeKindEnum.doc);
    const hasDefaultType = Object.keys(this.nodetypes).includes('default');
    const nodeHasType = Object.keys(node).includes('type');
    ////
    // resolve kind
    if (!isValidKind) {
      console.warn(`not a valid nodekind: ${node.kind}`);
    } else {
      kind = node.kind;
    }
    ////
    // resolve type
    if (isDocKind && !isValidType && nodeHasType) {
      console.warn(`not a valid nodetype: ${node.type}`);
    }
    if (isDocKind && !isValidType && hasDefaultType) {
      type = 'default';
    }
    if (isDocKind && isValidType) {
      type = node.type;
      kind = undefined; // reset kind
    }
    ////
    // set color
    let colorfy = (kind !== undefined) ? this.nodekinds[kind] : this.nodetypes[type];
    if (typeof colorfy === 'string') {
      color = colorfy;
    } else if (typeof colorfy === 'function') {
      color = colorfy(type);
    } else {
      console.warn(`nodetype's color must resolve to a hex value: ${colorfy}`);
    }
    // if still uncolored, fallback
    if (color === undefined) {
      console.warn('using fallback nodetype color');
      color = this.fallbackColor;
    }
    // done
    return color;
  }

  setHoverNode(node, radius, alpha, labelled) {
    // hovering node //
    if (this.isHoverActive
      && this.hoverNode
      && (node === this.hoverNode)
    ) {
      radius *= 2;
      alpha = (this.dim === DimEnum['2d']) ? 1.0 : 0.75;
      labelled = false;
    // non-hovering nodes //
    } else if ((this.isHoverActive
      && this.hoverNode
      && (node !== this.hoverNode)
      && (!this.selectedNodes.has(node))
      && (((this.kind === GraphKindEnum.web) && !this.hoverNode.neighbors.nodes.includes(node))
        || ((this.kind === GraphKindEnum.tree) && !this.hoverNode.lineage.nodes.includes(node)))
    ) || 
    // non-hovering links //
      (this.hoverLink && this.hoverLink.source !== node && this.hoverLink.target !== node)
    ) {
      alpha = (this.dim === DimEnum['2d']) ? 0.25 : 0.20;
      labelled = false;
    //  //
    } else {
      alpha = (this.dim === DimEnum['2d']) ? 1.0 : 0.75;
      labelled = true;
    }
    return [radius, alpha, labelled];
  }

  ////
  // interactions

  onClickNode(node, event) {
    if (this.isClickActive) {
      if (this.isSelectActive && event.shiftKey) {
        if (!this.selectedNodes.has(node)) {
          this.selectedNodes.add(node);
        } else {
          this.selectedNodes.delete(node);
        }
      } else {
        this.centerNode(node);
      }
    }
  }

  onDragNode(node, translate) {
    if (this.isDragActive) {
      if (this.isFixActive) {
        // move dragged node
        node.fx = node.x + translate.x;
        node.fy = node.y + translate.y;
        if (this.dim !== DimEnum['2d']) {
          node.fz = node.z + translate.z;
        }
        if (this.isSelectActive) {
          // if node wasn't a selected node, update selected nodes
          if (!this.selectedNodes.has(node)) {
            this.selectedNodes.clear();
            if (this.dim !== DimEnum['2d']) {
              this.reshape();
            }
          }
          // move selected nodes alongside dragged node
          for (let snode of this.selectedNodes) {
            if (snode !== node) {
              snode.fx = snode.x + translate.x;
              snode.fy = snode.y + translate.y;
              if (this.dim !== DimEnum['2d']) {
                snode.fz = snode.z + translate.z;
              }
            }
          }
        }
      }
    }
  }

  onDragEndNode(node) {
    if (this.isDragActive) {
      let draggedNodes = [node];
      if (this.isSelectActive) {
        draggedNodes = draggedNodes.concat(Array.from(this.selectedNodes));
      }
      // fix node (and selected nodes) in place
      if (this.isFixActive) {
        for (let dnode of draggedNodes) {
          this.stick(dnode);
        }
      // release node(s)
      } else {
        for (let snode of this.selectedNodes) {
          if (snode !== node) {
            this.unstick(snode);
          }
        }
      }
    }
  }

  onHoverNode(node, prevNode) {
    if (this.isHoverActive) {
      this.highlightNodes.clear();
      this.highlightLinks.clear();
      if (node) {
        this.highlightNodes.add(node);
        if (this.kind === GraphKindEnum.tree) {
          node.lineage.nodes.forEach(node => this.highlightNodes.add(node));
          node.lineage.links.forEach(link => this.highlightLinks.add(link));
        }
        if (this.kind === GraphKindEnum.web) {
          node.neighbors.nodes.forEach(node => this.highlightNodes.add(node));
          node.neighbors.links.forEach(link => this.highlightLinks.add(link));
        }
      }
      this.hoverNode = node || null;
      if ((this.dim === DimEnum['3d']) && (node !== prevNode)) {
        this.reshape();
      }
    }
  }

  onHoverLink(link) {
    if (this.isHoverActive) {
      this.highlightNodes.clear();
      this.highlightLinks.clear();
      if (link) {
        this.highlightLinks.add(link);
        this.highlightNodes.add(link.source);
        this.highlightNodes.add(link.target);
      }
      this.hoverLink = link || null;
      if (this.dim === DimEnum['3d']) {
        this.reshape();
      }
    }
  }

  // box selection

  onSelectStart(evt) {
    if (this.isSelectActive && evt.shiftKey) {
      evt.preventDefault();
      if (this.dim === DimEnum['3d']) {
        // hold camera position
        this.cameraPos = this.graph.cameraPosition();
      }
      // create box selector
      this.selectBox = document.createElement('div');
      this.selectBox.className = 'select-box';
      // css: size + coords
      this.selectBox.style.width = '0px';
      this.selectBox.style.height = '0px';
      // selected coordinates
      this.selectStartPoint = {
        x: evt.clientX,
        y: evt.clientY,
      };
      this.graphWrap.appendChild(this.selectBox);
      if (this.dim === DimEnum['3d']) {
        // window <-> graph-coords translation
        this.selectTranslator.startPoint.set(
          (evt.clientX / window.innerWidth) * 2 - 1,
          - (evt.clientY / window.innerHeight) * 2 + 1,
          0.5,
        );
      }
    }
  }

  onSelect(evt) {
    if (this.isSelectActive && evt.shiftKey && this.selectBox) {
      evt.preventDefault();
      if (this.dim === DimEnum['3d']) {
        // hold camera position
        this.graph.cameraPosition(this.cameraPos);
      }
      // css
      const left = Math.min(this.selectStartPoint.x, evt.clientX);
      const right = Math.max(this.selectStartPoint.x, evt.clientX);
      const top = Math.min(this.selectStartPoint.y, evt.clientY);
      const bottom = Math.max(this.selectStartPoint.y, evt.clientY);
      // css: size + coords
      this.selectBox.style.left = left + 'px';
      this.selectBox.style.top = top + 'px';
      this.selectBox.style.width = (right - left) + 'px';
      this.selectBox.style.height = (bottom - top) + 'px';
      if (this.dim === DimEnum['3d']) {
        // window <-> graph-coords translation
        this.selectTranslator.endPoint.set(
          (evt.clientX / window.innerWidth) * 2 - 1,
          - (evt.clientY / window.innerHeight) * 2 + 1,
          0.5,
        );
      }
    }
    // just-in-case: cleanup if not selecting
    if (!evt.shiftKey && this.selectBox) {
      this.selectBox.remove();
      this.selectBox = undefined;
    }
  }

  onSelectEnd(evt) {
    if (this.isSelectActive && this.selectBox) {
      evt.preventDefault();
      if (this.dim === DimEnum['2d']) {
        const left = Math.min(this.selectStartPoint.x, evt.clientX);
        const right = Math.max(this.selectStartPoint.x, evt.clientX);
        const top = Math.min(this.selectStartPoint.y, evt.clientY);
        const bottom = Math.max(this.selectStartPoint.y, evt.clientY);
        const tl = this.graph.screen2GraphCoords(left, top);
        const br = this.graph.screen2GraphCoords(right, bottom);
        // set selected nodes
        const selectedNodes = [];
        this.data()['nodes'].forEach((node) => {
          if (tl.x < node.x && node.x < br.x
          && br.y > node.y && node.y > tl.y
          ) {
            selectedNodes.push(node);
          };
        });
        this.selectedNodes = new Set(selectedNodes);
      }
      if (this.dim === DimEnum['3d']) {
        // window <-> graph-coords translation
        this.selectTranslator.endPoint.set(
          (evt.clientX / window.innerWidth) * 2 - 1,
          - (evt.clientY / window.innerHeight) * 2 + 1,
          0.5,
        );
        // todo: keep an eye on this...
        // set selected nodes
        this.selectedNodes = new Set(this.selectTranslator.select()
                                                          .filter((item) => item.__graphObjType === 'node')
                                                          .map((item) => item.__data)); // 'item.__data' should be the rendered node object
      }
      // remove selection box
      if (this.selectBox) {
        this.selectBox.remove();
        this.selectBox = undefined;
      }
      if (this.dim === DimEnum['3d']) {
        // release camera position
        this.cameraPos = undefined;
        // render selected nodes
        this.reshape();
      }
    }
  }

  ////
  // interaction / graph view helpers

  // data

  autosync(data) {
    this.draw(data);
    return;
  }

  save() {
    return this.dataCache;
  }

  sync() {
    this.draw(this.dataCache);
    return;
  }

  // view

  flip() {
    this.data()['nodes'].forEach((node) => node.fy *= -1);
  }

  centerNode(node) {
    // 2d
    if (this.dim === DimEnum['2d']) {
      this.graph.centerAt(node.x, node.y, this.centerSpeed);
    // 3d
    } else {
      // "aim at node from outside it"
      const distance = 100;
      const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
      const newPos = node.x || node.y || node.z
                    ? { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }
                    : { x: 0, y: 0, z: distance }; // special case if node is in (0,0,0)
      this.graph.cameraPosition(newPos, node, this.centerSpeed);
    }
  }

  restick(node) {
    let cachedNode = this.dataCache['nodes'].find((d) => (d.id === node.id));
    if ((cachedNode !== undefined) && (cachedNode.coord !== undefined)) {
      node.fx = cachedNode.coord[0];
      node.fy = cachedNode.coord[1];
      if (this.dim !== DimEnum['2d']) {
        node.fy *= this.flipYAxis;
        node.fz = cachedNode.coord[2];
      }
    }
  }

  stick(node) {
    // graph
    node.fx = node.x;
    if (this.kind !== GraphKindEnum.tree) {
      node.fy = node.y;
    }
    if (this.dim !== DimEnum['2d']) {
      node.fz = node.z;
    }
    // coord
    let cachedNode = this.dataCache['nodes'].find((d) => (d.id === node.id));
    if ((cachedNode === undefined) || (cachedNode.coord == undefined)) {
      cachedNode.coord = [0, 0, 0];
    }
    cachedNode.coord[0] = node.x;
    cachedNode.coord[1] = node.y;
    if (this.dim !== DimEnum['2d']) {
      cachedNode.coord[1] *= this.flipYAxis;
      cachedNode.coord[2] = node.z;
    }
  }

  unstick(node) {
    // release node position if 'fix' option is off
    node.fx = undefined;
    if (this.kind !== GraphKindEnum.tree) {
      node.fy = undefined;
    }
    if (this.dim !== DimEnum['2d']) {
      node.fz = undefined;
    }
  }
}
