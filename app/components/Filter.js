import React, { Component } from 'react';
import { Link, Redirect } from 'react-router-dom';

import { nest } from 'd3-collection';
import Table from 'rc-table';

import DataContainer from '../DataContainer';
import { setProjectFilters, getProjectFilters, exportProjectData } from '../projects.js';

import FrequencyChart from './FrequencyChart';
import FilterChart from './FilterChart';
import CheckBoxes from './CheckBoxes';
import Summary from './Summary';
import Loader from './Loader';

import styles from './Filter.css';
import logo from 'images/phinch.png';

import vis from 'images/vis-placeholder-sm.png';

export default class Filter extends Component {
  constructor(props) {
    super(props);

    this.timeout = null;

    this.sort = {
      reverse: false,
      key: 'biomid',
    };

    this.state = {
      summary: DataContainer.getSummary(),
      data: DataContainer.getSamples(),
      deleted: [],
      names: {},
      height: window.innerHeight,
      filters: {},
      result: null,
      showHidden: false,
      loading: false,
      redirect: null,
    };

    this.state.redirect = (this.state.summary.name && this.state.summary.size) ? null : '/';

    this.init = getProjectFilters(this.state.summary.path, this.state.summary.name);

    this.filters = {
      date: {},
      number: {},
      string: {},
    };

    /*
      FILTER Controls
    */
    // TODO: Move this to data container or similar
    if (this.state.data.length) {
      const metadata = this.state.data[0].metadata;
      this.metadataKeys = Object.keys(metadata).filter(k => k !== 'phinchID');
      this.metadataKeys.forEach((k) => {
        const units = [];
        const values = nest()
          .key(d => d)
          .entries(this.state.data.slice().map((d) => {
            const [value,unit] = d.metadata[k].split(' ');
            if (unit !== undefined && !units.includes(unit)) {
              units.push(unit);
            }
            return value;
          }).filter(d => d !== 'no_data')).map((d, i) => {
            return {
              index: i,
              value: d.key,
              count: d.values.length,
            };
          });
        const unit = units.length ? units[0] : '';
        let groupKey = 'string';
        let filterValues = values.slice();
        /*
          TODO: Test w/ Additional Date / Metadata Types
        */
        if (k.toLowerCase().trim().includes('date') || k.toLowerCase().trim().includes('year')) {
          groupKey = 'date';
          filterValues = values.slice().map((d, i) => {
            if (k.toLowerCase().trim().includes('date')) {
              d.value = new Date(d.value);
            } if (this.filterFloat(d.value) !== null) {
              d.value = this.filterFloat(d.value);
            }
            return d;
          }).sort((a, b) => {
            return a.value.valueOf() - b.value.valueOf();
          }).map((d, i) => {
            d.index = i;
            return d;
          });
        } else if (this.filterFloat(values.filter(v => v.value !== 'no_data')[0].value) !== null) {
          groupKey = 'number';
          filterValues = values.slice().map((v) => {
            if (this.filterFloat(v.value) !== null) {
              v.value = this.filterFloat(v.value);
            }
            return v;
          }).sort((a, b) => {
            return a.value - b.value;
          }).map((d, i) => {
            d.index = i;
            return d;
          });
        }
        let range = {
          min: filterValues[0],
          max: filterValues[filterValues.length - 1],
        };
        if (groupKey === 'string') {
          range = {};
          filterValues.map((v) => {
            range[v.value] = true;
          });
        }
        this.state.filters[k] = {
          key: k,
          unit: unit,
          range: range,
          type: groupKey,
          values: filterValues,
          expanded: false,
        };
        this.filters[groupKey][k] = {
          values: filterValues,
          unit: unit,
        };
        if (this.init.filters[k]) {
          this.init.filters[k].values = filterValues;
          if (k.toLowerCase().trim().includes('date')) {
            this.init.filters[k].range.max.value = new Date(this.init.filters[k].range.max.value);
            this.init.filters[k].range.min.value = new Date(this.init.filters[k].range.min.value);
          }
          this.state.filters[k] = this.init.filters[k];
        }
      });
      this.state.deleted = this.init.deleted;
      this.state.names = this.init.names;
      if (this.init.sort) {
        this.sort = this.init.sort;
      }
    }

    this.columns = [
      {
        title: this.generateTableTitle('order', false),
        dataIndex: 'order',
        key: 'order',
        render: (t) => (
          <div className={styles.order}>
            <div className={styles.cell}>
              {(t !== undefined) ? t.toLocaleString() : ''}
            </div>
          </div>
        ),
      },
      {
        title: this.generateTableTitle('phinchName', true),
        dataIndex: 'phinchName',
        key: 'phinchName',
        render: (t, r) => (
          <div className={styles.phinchName}>
            <div className={styles.cell}>
              <input
                className={styles.input}
                type="text"
                value={t}
                onChange={(e) => this.updatePhinchName(e, r)}
              />
            </div>
          </div>
        ),
      },
      {
        title: this.generateTableTitle('biomid', true),
        dataIndex: 'biomid',
        key: 'biomid',
        render: (t) => (
          <div className={styles.biomid}>
            <div className={styles.cell}>
              {t}
            </div>
          </div>
        ),
      },
      {
        title: this.generateTableTitle('sampleName', true),
        dataIndex: 'sampleName',
        key: 'sampleName',
        render: (t) => (
          <div className={styles.sampleName}>
            <div className={styles.cell}>
              {t}
            </div>
          </div>
        ),
      },
      {
        title: this.generateTableTitle('reads', true),
        dataIndex: 'reads',
        key: 'reads',
        render: (t) => (
          <div className={styles.cell}>
            {t.toLocaleString()}
          </div>
        ),
      },
      {
        title: '',
        dataIndex: '',
        key: 'chart',
        render: (d) => (
          <div className={styles.cell}>
            <FrequencyChart data={this.state.data.concat(this.state.deleted)} value={d.reads} width={120 * 2} height={18 * 2} />
          </div>
        ),
      },
      {
        title: '',
        dataIndex: '',
        key: 'drag',
        render: (r) => (
          <div className={styles.cell}>
            <div>
              <div className={`${styles.delete} ${styles.drag}`} style={{'transform': 'rotate(90deg)'}}>||</div>
            </div>
          </div>
        ),
      },
      {
        title: '',
        dataIndex: '',
        key: 'remove',
        render: (r) => (
          <div className={`${styles.cell} ${styles.noLeft}`}>
            <div onClick={() => { this.removeRows([r]) }}>
              <div className={styles.delete}>x</div>
            </div>
          </div>
        ),
      }
    ];

    this.deletedColumns = this.columns.map((c) => {
      return Object.assign({}, c);
    }).filter((c) => {
      return !(c.key === 'remove' || c.key === 'drag' || c.key === 'order');
    }).map((c) => {
      c.title = this.generateTableTitle(c.key, false);
      return c;
    });
    this.deletedColumns.push({
      title: '',
      dataIndex: '',
      key: 'remove',
      render: (r) => (
        <div className={styles.cell}>
          <div onClick={() => { this.restoreRows([r]) }}>
            <div className={styles.delete}>⤴</div>
          </div>
        </div>
      ),
    });

    this.dragEnd = this.dragEnd.bind(this);
    this.dragOver = this.dragOver.bind(this);
    this.dragStart = this.dragStart.bind(this);
    this.setResult = this.setResult.bind(this);
    this.clearResult = this.clearResult.bind(this);
    this.updateChecks = this.updateChecks.bind(this);
    this.getSortArrow = this.getSortArrow.bind(this);
    this.applyFilters = this.applyFilters.bind(this);
    this.resetFilters = this.resetFilters.bind(this);
    this.updateFilters = this.updateFilters.bind(this);
    this.redirectToVis = this.redirectToVis.bind(this);
    this.updateDimensions = this.updateDimensions.bind(this);
  }

  componentDidMount() {
    window.addEventListener('resize', this.updateDimensions);
    this.applyFilters(this.state.filters, this.state.names, this.state.deleted);
  }

  componentWillUnmount() {
    clearTimeout(this.timeout);
    window.removeEventListener('resize', this.updateDimensions);
  }

  updateDimensions() {
    this.setState({height:window.innerHeight});
  }

  filterFloat(value) {
    if (/^(\-|\+)?([0-9]+(\.[0-9]+)?|Infinity)$/.test(value)) {
      return Number(value);
    }
    return null;
  }

  generateTableTitle(key, click) {
    if (key === 'remove' || key === 'chart' || key === 'drag') {
      return '';
    }
    if (key === 'order') {
      click = false;
    }
    const names = {
      order: '',
      phinchName: 'Phinch Name',
      biomid: 'BIOM ID',
      sampleName: 'Sample Name',
      reads: 'Sequence Reads',
    };
    const onClick = click ? (() => { this.sortBy(key, this.state.data, true) }) : (() => {});
    const arrow = click ? (this.getSortArrow(key)) : '';
    return (
      <div
        className={`${styles.heading} ${styles[key]}`}
        onClick={onClick}
      >
        {names[key]} {arrow}
      </div>
    );
  }

  setResult(value) {
    const result = value;
    this.timeout = setTimeout(() => {
      this.clearResult();
    }, 3000);
    const loading = false;
    this.setState({result, loading});
  }

  clearResult() {
    const result = null;
    this.setState({result});
  }

  resetFilters() {
    const filters = {};
    Object.keys(this.state.filters).forEach((k) => {
      const filter = this.state.filters[k];
      if (filter.type === 'string') {
        Object.keys(filter.range).forEach((r) => {
          filter.range[r] = true;
        });
      } else {
        filter.range.min = Object.assign({}, filter.values[0]);
        filter.range.max = Object.assign({}, filter.values[filter.values.length - 1]);
      }
      filters[k] = filter;
    });
    this.applyFilters(filters, this.state.names, this.state.deleted);
  }

  applyFilters(filters, names, deleted) {
    const deletedSamples = deleted.map(d => d.sampleName);
    let data = DataContainer.getSamples().map((d, i) => {
      if (names[d.sampleName]) {
        d.phinchName = names[d.sampleName];
      }
      return d;
    }).filter((d, i) => {
      let include = true;
      if (deletedSamples.includes(d.sampleName)) {
        include = false;
      }
      Object.keys(filters).forEach((k) => {
        let value = d.metadata[k].split(' ')[0];
        if (k.toLowerCase().trim().includes('date')) {
          value = new Date(value);
          if (value.valueOf() < filters[k].range.min.value.valueOf() || value.valueOf() > filters[k].range.max.value.valueOf()) {
            include = false;
          }
        } else if (filters[k].type === 'number' || filters[k].type === 'date') {
          if (this.filterFloat(value) !== null) {
            value = this.filterFloat(value);
            if (value < filters[k].range.min.value || value > filters[k].range.max.value) {
              include = false;
            }
          }
        } else {
          if (value !== 'no_data' && !filters[k].range[value]) {
            include = false;
          }
        }
      });
      return include;
    });
    this.sort.reverse = !this.sort.reverse;
    data = this.sortBy(this.sort.key, data, false);
    this.setState({filters, data});
  }

  updateChecks(attribute, type, value) {
    const filters = this.state.filters;
    filters[attribute].range[type] = value;
    this.applyFilters(filters, this.state.names, this.state.deleted);
  }

  updateFilters(attribute, min, max) {
    const filters = this.state.filters;
    let minValue = Object.assign({}, this.state.filters[attribute].values[min]);
    if (min >= this.state.filters[attribute].values.length) {
      minValue = Object.assign({}, this.state.filters[attribute].values[this.state.filters[attribute].values.length - 1]);
      if (minValue.value instanceof Date) {
        minValue.value = new Date(minValue.value.valueOf() + 1);
      } else {
        minValue.value += 1;
      }
    }
    let maxValue = Object.assign({}, this.state.filters[attribute].values[max]);
    if (max < 0) {
      maxValue = Object.assign({}, this.state.filters[attribute].values[0]);
      if (maxValue.value instanceof Date) {
        maxValue.value = new Date(maxValue.value.valueOf() - 1);
      } else {
        maxValue.value -= 1;
      }
    }
    filters[attribute].range = {
      min: minValue,
      max: maxValue,
    };
    this.applyFilters(filters, this.state.names, this.state.deleted);
  }

  displayFilters() {
    const SectionNames = {
      date: 'Date Range',
      number: 'Numeric Range',
      string: 'Categories',
    };
    return Object.keys(this.filters).map((k) => {
      const group = Object.keys(this.filters[k]).map((g) => {
        const expanded = this.state.filters[g].expanded;
        const icon = expanded ? '-' : '+';
        const width = 200;
        const height = expanded ? 60 : 20;
        const filter = (this.state.filters[g].type === 'string') ? (
            <CheckBoxes
              name={g}
              data={this.filters[k][g]}
              filter={this.state.filters[g]}
              update={this.updateChecks}
            />
          ) : (
            <FilterChart
              name={g}
              data={this.filters[k][g]}
              width={width}
              height={height}
              filter={this.state.filters[g]}
              update={this.updateFilters}
            />
          );
        return (
          <div key={g} className={styles.filter}>
            <div className={styles.expand} onClick={() => {
              const filters = this.state.filters;
              filters[g].expanded = !filters[g].expanded;
              this.setState({filters});
            }}>{icon}</div>
            {filter}
          </div>
        );
      });
      return (
        <div key={k} className={styles.bottom}>
          <div className={styles.heading}>
            {SectionNames[k]}
          </div>
          <div className={styles.outline}>
            {group}
          </div>
        </div>
      );
    });
  }

  displayHiddenSamples() {
    const label = this.state.showHidden ? 'Hide' : 'Show';
    const button = this.state.deleted.length ? (
        <div
          className={styles.heading}
          style={{
            marginTop: '1rem',
            cursor: 'pointer',
          }}
          onClick={() => {
            const showHidden = !this.state.showHidden;
            this.setState({showHidden});
          }}
        >
          {label} Removed Samples
        </div>
      ) : '';
    const table = this.state.showHidden ? (
        <div className={styles.modal}>
          <p>Removed Samples</p>
          <Table
            className={styles.table}
            rowClassName={(r, i) => {
              if (i%2 === 0) {
                return styles.grey;
              }
              return;
            }}
            scroll={{ y: (296) }}
            columns={this.deletedColumns}
            data={this.state.deleted}
            rowKey={row => `d-${row.id}`}
          />
        </div>
      ) : '';
    return (
      <div>
        {table}
        {button}
      </div>
    );
  }

  updatePhinchName(e, r) {
    const names = this.state.names;
    const data = this.state.data.map((d) => {
      if (d.sampleName === r.sampleName) {
        d.phinchName = e.target.value;
      }
      names[d.sampleName] = d.phinchName;
      return d;
    });
    this.setState({data, names});
  }

  removeRows(rows) {
    const data = this.state.data.filter((d) => {
      return !rows.includes(d);
    });
    const deleted = this.state.deleted.concat(rows);
    this.setState({data, deleted});
  }

  restoreRows(rows) {
    const deleted = this.state.deleted.filter((d) => {
      return !rows.includes(d);
    });
    const data = this.state.data.concat(rows).sort((a, b) => {
      if (!this.sort.reverse) {
        if (a[this.sort.key] < b[this.sort.key]) return -1;
        if (a[this.sort.key] > b[this.sort.key]) return 1;
        return 0;
      } else {
        if (b[this.sort.key] < a[this.sort.key]) return -1;
        if (b[this.sort.key] > a[this.sort.key]) return 1;
        return 0;
      }
    });
    const showHidden = deleted.length ? true : false;
    this.setState({data, deleted, showHidden});
  }

  getSortArrow(key) {
    if (key === this.sort.key) {
      const angle = this.sort.reverse ? 180 : 0;
      return (<div className={styles.arrow} style={{transform: `rotate(${angle}deg)`}}>⌃</div>);
    } else {
      return '';
    }
  }

  sortBy(key, indata, setstate) {
    this.sort.key = key;
    const data = indata.sort((a, b) => {
      if (this.sort.reverse) {
        if (a[key] < b[key]) return -1;
        if (a[key] > b[key]) return 1;
        return 0;
      } else {
        if (b[key] < a[key]) return -1;
        if (b[key] > a[key]) return 1;
        return 0;
      }
    }).map((d, i) => {
      d.order = i;
      return d;
    });
    this.sort.reverse = !this.sort.reverse;
    this.columns = this.columns.map((c) => {
      c.title = this.generateTableTitle(c.key, true);
      return c;
    });
    if (setstate) {
      this.setState({data});
    } else {
      return data;
    }
  }

  dragEnd(e) {
    let target = Number(this.over.dataset.id);
    if ((e.clientY - this.over.offsetTop) > (this.over.offsetHeight / 2)) {
      target++;
    }
    if (this.dragged <= target) {
      target--;
    }
    //
    let data = this.state.data;
    data.splice(target, 0, data.splice(this.dragged, 1)[0]);
    data = data.map((d, i) => {
      d.order = i;
      return d;
    });
    // 
    this.over.style = null;
    this.over = null;
    this.dragged = null;
    //
    this.sort.reverse = true;
    this.sortBy('order', data, true);
  }
  dragOver(e) {
    e.preventDefault();
    if (this.over) {
      this.over.style = null;
    }
    this.over = e.currentTarget;
    // I know this isn't the React way, but re-rendering the whole table takes forever
    this.over.style = 'background: #e4e4e4; height: 3rem; vertical-align: top;';
  }
  dragStart(e) {
    this.dragged = Number(e.currentTarget.dataset.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', null);
  }

  redirectToVis(result) {
    if (result === 'error') {
      this.setResult(result);
    } else {
      this.setState({redirect: '/vis'});
    }
  }

  render() {
    const redirect = this.state.redirect === null ? '' : <Redirect push to={this.state.redirect} />;
    const resultStyle = this.state.result === 'error' ? styles.error : styles.success;
    const result = (
      <div className={styles.button}>
        <div className={resultStyle} onClick={this.clearResult}>
          {this.state.result}
        </div>
      </div>
      );
    return (
      <div className={styles.container}>
        <Loader loading={this.state.loading} />
        {redirect}
        <div className={styles.header}>
          <div className={styles.logo}>
            <Link to="/">
              <img src={logo} alt='Phinch' />
            </Link>
          </div>
          <Summary summary={this.state.summary} datalength={this.state.data.length} />
          {/*
          <div className={styles.button}>
            <div className={styles.heading} onClick={() => {
              // show picker to allow custom name?
              this.setState({ loading: true});
              // this is more consistent than the setState callback
              setTimeout(() => {
                const biom = DataContainer.applyFiltersToData(this.state.data);
                exportProjectData(this.state.summary.path, this.state.summary.name, biom, this.setResult);
              }, 1);
            }}>
              Export Filtered BIOM File
            </div>
          </div>
          */}
          <div className={styles.button}>
            <div className={styles.heading} onClick={() => {
              setProjectFilters(
                this.state.summary.path,
                this.state.summary.name,
                this.state.filters,
                this.state.names,
                this.state.deleted,
                this.sort,
                this.setResult,
                );
            }}>
              Save Filters
            </div>
          </div>
          <div className={styles.button}>
            <div className={styles.heading} onClick={() => {
              this.setState({ loading: true});
              setTimeout(() => {
                DataContainer.applyFiltersToData(this.state.data);
                setProjectFilters(
                  this.state.summary.path,
                  this.state.summary.name,
                  this.state.filters,
                  this.state.names,
                  this.state.deleted,
                  this.sort,
                  this.redirectToVis,
                  );
              }, 1);
            }}>
              Save & View <div className={styles.arrow} style={{transform: `rotate(${90}deg)`}}>⌃</div><br />
              <img src={vis} alt='' style={{width: '112px', height: '24px', margin: '2px 0'}}/>
            </div>
          </div>
          {result}
        </div>
        <div>
          <div className={`${styles.section} ${styles.left}`} style={{
            display: 'inline-block',
            height: (this.state.height - 125),
            overflowY: 'overlay', // 'scroll',
          }}>
            {this.displayFilters()}
            <div
              className={styles.heading}
              style={{ cursor: 'pointer' }}
              onClick={this.resetFilters}
            >
              Reset Filters
            </div>
          </div>
          <div className={`${styles.section} ${styles.right}`}>
            <Table
              className={styles.table}
              scroll={{ y: (this.state.height - 194) }}
              columns={this.columns}
              data={this.state.data}
              rowKey={row => row.id}
              onRow={(r, i) => {
                const className = (i%2 === 0) ? (
                  styles.grey
                ) : '';
                return {
                  'data-id': r.order,
                  'className': className,
                  'key': r.sampleName,
                  'draggable': 'true',
                  'onDragEnd': this.dragEnd,
                  'onDragOver': this.dragOver,
                  'onDragStart': this.dragStart,
                }
              }}
            />
            {this.displayHiddenSamples()}
          </div>
        </div>
      </div>
    );
  }
}
