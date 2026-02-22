// src/widgets/countrySelector.js

const DEFAULT_COUNTRIES = [
  { value: 'all', label: 'All Countries' },
  { value: 'us', label: 'US / NASA / Starlink' },
  { value: 'russia', label: 'Russia / Soviet' },
  { value: 'china', label: 'China' },
  { value: 'esa', label: 'ESA / Europe' },
  { value: 'japan', label: 'Japan' },
  { value: 'india', label: 'India' },
  { value: 'other', label: 'Other' },
];

export function setupCountrySelector({
  initialCountry = 'all',
  countries = null,
  onCountryChange,
  mountTarget = null,
}) {
  const container = document.createElement('section');
  container.className = 'sidebar-widget tracked-group-widget country-selector-widget';

  const title = document.createElement('h3');
  title.className = 'sidebar-widget__title';
  title.textContent = 'Country Selector';

  const content = document.createElement('div');
  content.className = 'sidebar-widget__content tracked-group-widget__content';

  const label = document.createElement('label');
  label.className = 'tracked-group-widget__label';
  label.innerText = 'Filter by Country';
  label.htmlFor = 'satellite-country-select';

  const select = document.createElement('select');
  select.id = 'satellite-country-select';
  select.className = 'tracked-group-widget__select';

  const options = Array.isArray(countries) && countries.length > 0 ? countries : DEFAULT_COUNTRIES;
  options.forEach((option) => {
    const opt = document.createElement('option');
    opt.value = option.value;
    opt.innerText = option.label;
    if (option.value === initialCountry) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });

  select.addEventListener('change', (e) => {
    if (onCountryChange) {
      onCountryChange(e.target.value);
    }
  });

  content.append(label, select);
  container.append(title, content);
  (mountTarget || document.body).appendChild(container);

  return {
    container,
    getValue: () => select.value,
  };
}
