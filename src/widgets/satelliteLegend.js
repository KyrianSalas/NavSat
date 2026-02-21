const LEGEND_ID = 'satelliteLegend';
const LEGEND_COLLAPSED_CLASS = 'is-collapsed';

function setCollapsedState(legend, toggleButton, collapsed) {
  legend.classList.toggle(LEGEND_COLLAPSED_CLASS, collapsed);
  toggleButton.textContent = collapsed ? '\u25B8' : '\u25BE';
  toggleButton.setAttribute('aria-label', collapsed ? 'Expand legend' : 'Collapse legend');
  toggleButton.setAttribute('aria-expanded', String(!collapsed));
}

export function setupSatelliteLegend({ items = [] } = {}) {
  let legend = document.getElementById(LEGEND_ID);
  if (!legend) {
    legend = document.createElement('aside');
    legend.id = LEGEND_ID;
    legend.setAttribute('aria-label', 'Satellite Color Legend');
    document.body.appendChild(legend);
  }

  const startsCollapsed = legend.classList.contains(LEGEND_COLLAPSED_CLASS);
  legend.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'satellite-legend__header';

  const title = document.createElement('h3');
  title.className = 'satellite-legend__title';
  title.textContent = 'Legend';

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.className = 'satellite-legend__toggle';
  toggleButton.addEventListener('click', (event) => {
    event.preventDefault();
    const collapsed = legend.classList.contains(LEGEND_COLLAPSED_CLASS);
    setCollapsedState(legend, toggleButton, !collapsed);
  });

  header.append(title, toggleButton);
  legend.appendChild(header);

  const list = document.createElement('ul');
  list.className = 'satellite-legend__list';
  legend.appendChild(list);

  for (let i = 0; i < items.length; i += 1) {
    const entry = items[i];
    const row = document.createElement('li');
    row.className = 'satellite-legend__item';

    const swatch = document.createElement('span');
    swatch.className = 'satellite-legend__swatch';
    swatch.style.backgroundColor = entry.color;
    swatch.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'satellite-legend__label';
    label.textContent = entry.label;

    row.append(swatch, label);
    list.appendChild(row);
  }

  setCollapsedState(legend, toggleButton, startsCollapsed);

  return legend;
}
