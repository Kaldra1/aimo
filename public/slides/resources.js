// Програвач презентацій Claude Design бере React з unpkg.com; тут — локальні копії з npm,
// щоб слайди працювали офлайн і без сторонніх CDN.
window.__resources = {
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js': './vendor/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': './vendor/react-dom.production.min.js',
};
