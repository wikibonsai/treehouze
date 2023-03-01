export default class Ctrls {

  constructor(opts) {
    // ctrls
    this.enabled        = opts.enabled ? opts.enabled                 : true;
    this.exclude        = opts.exclude ? opts.exclude                 : [];
    // graph properties
    this.dim            = opts.dim     ? opts.dim                     : DimEnum['2d'];
    this.kind           = opts.kind    ? opts.kind                    : KindEnum.web;
    // actions
    this.isClickActive  = opts.click   ? opts.click                   : true;
    this.isDragActive   = opts.drag    ? opts.drag                    : true;
    this.isFixActive    = opts.fix     ? opts.fix                     : false;
    this.isFollowActive = opts.follow  ? opts.follow                  : true;
    this.isHoverActive  = opts.hover   ? opts.hover                   : true;

    // todo: take in methods/functions to hook up to ctrls

    // controls
    this.setupCtrls();
  }

  setupCtrls(opts = {}) {
    if (!this.enabled) { return; }
    const DEFAULT_CTRLS = {
      // graph properties
      kind: KindEnum.web,
      dim: this.dim,
      // actions
      click: this.isClickActive,
      drag: this.isDragActive,
      follow: this.isFollowActive,
      fix: this.isFixActive,
      hover: this.isHoverActive,
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

    // graph properties
    // kind
    if (!this.exclude.includes('kind')) {
      this.kindInput = this.ctrlPane.addInput(
        ctrls, 'kind',
        {
          options: {
            'tree': KindEnum.tree,
            'web': KindEnum.web,
          }
        }
      );
      this.ctrlPane.kindInput.on('change', (ev) => {
        this.updateKind(ev.value);
        this.draw();
      });
    }
    // dim
    if (!this.exclude.includes(CtrlEnum.dim)) {
      this.ctrlPane.dimInput = this.ctrlPane.addInput(
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
      this.ctrlPane.dimInput.on('change', (ev) => {
        this.updateDim(ev.value);
        this.draw();
      });
    }
    // fix <-> force
    if (!this.exclude.includes(CtrlEnum.fix)) {
      this.ctrlPane.fixInput = this.ctrlPane.addInput(ctrls, 'fix');
      this.ctrlPane.fixInput.on('change', (ev) => this.updateFixActive(Boolean(ev.value)));
    }
    // follow
    if (!this.exclude.includes(CtrlEnum.follow)) {
      this.ctrlPane.followInput = this.ctrlPane.addInput(ctrls, 'follow');
      this.ctrlPane.followInput.on('change', (ev) => this.updateFollowActive(Boolean(ev.value)));
    }
    // save coord
    if (!this.exclude.includes(CtrlEnum.save)) {
      // folder
      const folder = this.ctrlPane.addFolder({
        title: 'save (coordinates)',
        expanded: false,
      });
      this.ctrlPane.save = folder.addButton({
        title: 'save',
        // label: 'save',
      });
      this.ctrlPane.save.on('click', () => this.save());
    }

    // update ctrl vars
    if (Object.keys(opts).length > 0) {
      this.updateCtrls(opts);
    }
  }

  ////
  // input methods

  save() {
    return this.dataCache;
  }

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
      // actions
      case CtrlEnum.click: {
        this.updateClickActive(value);
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
      case CtrlEnum.hover: {
        this.updateHoverActive(value);
        break;
      }
      default: { console.warn(`invalid ctrl: ${ctrl}`); }
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
    if (!Object.values(KindEnum).includes(value)) {
      console.warn(`invalid graph 'kind': ${value}`);
    } else {
      this.kind = value;
    }
  }

  // actions

  updateClickActive(value) {
    this.isClickActive = Boolean(value);
  }

  updateHoverActive(value) {
    this.isHoverkActive = Boolean(value);
  }

  updateFixActive(value) {
    this.isFixActive = Boolean(value);
    if (this.hasData()) {
      // restick graph nodes
      for (let node of this.graph.graphData()['nodes']) {
        if (this.isFixActive) {
          this.restick(node);
          // this.graph.d3Force('center', null);
        } else {
          // todo: not sure if this is actually unsticking nodes...
          this.unstick(node);
        }
      }
    }
  }

  updateFollowActive(value) {
    this.isFollowActive = Boolean(value);
  }
}