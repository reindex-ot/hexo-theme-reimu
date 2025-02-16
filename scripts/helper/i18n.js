// modified from https://github.com/Jamling/hexo-generator-i18n

const { prettyUrls, Color } = require("hexo-util");
const moize = require("moize");

hexo.extend.helper.register("get_langs", function () {
  const i18n = hexo.theme.config.i18n;
  if (!i18n || !i18n.languages) {
    return [];
  }
  const languages = Array.isArray(i18n.languages)
    ? i18n.languages
    : [i18n.languages];

  return languages.filter((lang) => lang !== "default");
});

hexo.extend.helper.register("switch_lang", function (lang) {
  const languages = this.get_langs();
  const prettyUrlsOptions = Object.assign(
    {
      trailing_index: true,
      trailing_html: true,
    },
    hexo.config.pretty_urls
  );

  let path = this.page.path;
  const root = this.config.root || "";
  if (path.startsWith(this.page.lang)) {
    path = path.substring(this.page.lang.length);
  }
  if (!path.startsWith("/")) {
    path = "/" + path;
  }

  let result = "";
  if (languages.indexOf(lang) === 0) {
    result = root + path.substring(1);
  } else {
    result = root + lang + path;
  }
  return prettyUrls(result, prettyUrlsOptions);
});

hexo.extend.helper.register("url_for_lang", function (path, opt, language) {
  if (typeof opt === "string") {
    language = opt;
    opt = undefined;
  }
  const root = this.config.root || "";
  const lang = language ? language : this.page.lang;
  let url = this.url_for(path, opt);

  // ignore from url_for.
  if (
    url === "#" ||
    url.startsWith("//") ||
    url.includes("://") ||
    url.startsWith("mailto:")
  ) {
    return url;
  }

  if (!url.startsWith("/")) {
    url = "/" + url;
  }

  const relativeUrl = url.replace(root, "/");
  const pathLang = relativeUrl.split("/")[1];
  const languages = this.get_langs();

  if (languages.includes(pathLang)) {
    return url;
  }

  if (lang && lang !== languages[0]) {
    url = root + lang + relativeUrl;
  }

  return url;
});

// https://github.com/hexojs/hexo/blob/master/lib/plugins/helper/tagcloud.ts
function tagcloudHelper(tags, options) {
  if (
    !options &&
    (!tags || !Object.prototype.hasOwnProperty.call(tags, "length"))
  ) {
    options = tags;
    tags = this.site.tags;
  }
  tags = tags;
  if (!tags || !tags.length) return "";
  options = options || {};
  const min = options.min_font || 10;
  const max = options.max_font || 20;
  const orderby = options.orderby || "name";
  const order = options.order || 1;
  const unit = options.unit || "px";
  const color = options.color;
  const className = options.class;
  const showCount = options.show_count;
  const countClassName = options.count_class || "count";
  const level = options.level || 10;
  const { transform } = options;
  const separator = options.separator || " ";
  const result = [];
  let startColor, endColor;
  if (color) {
    if (!options.start_color) throw new TypeError("start_color is required!");
    if (!options.end_color) throw new TypeError("end_color is required!");
    startColor = new Color(options.start_color);
    endColor = new Color(options.end_color);
  }
  // Sort the tags
  if (orderby === "random" || orderby === "rand") {
    tags = tags.random();
  } else {
    tags = tags.sort(orderby, order);
  }
  // Limit the number of tags
  if (options.amount) {
    tags = tags.limit(options.amount);
  }
  const sizes = [];
  tags.sort("length").forEach((tag) => {
    const { length } = tag;
    if (sizes.includes(length)) return;
    sizes.push(length);
  });
  const length = sizes.length - 1;
  tags.forEach((tag) => {
    const ratio = length ? sizes.indexOf(tag.length) / length : 0;
    const size = min + (max - min) * ratio;
    let style = `font-size: ${parseFloat(size.toFixed(2))}${unit};`;
    const attr = className
      ? ` class="${className}-${Math.round(ratio * level)}"`
      : "";
    if (color) {
      const midColor = startColor.mix(endColor, ratio);
      style += ` color: ${midColor.toString()}`;
    }
    result.push(
      `<a href="${this.url_for_lang(tag.path)}" style="${style}"${attr}>${
        transform ? transform(tag.name) : tag.name
      }${
        showCount ? `<span class="${countClassName}">${tag.length}</span>` : ""
      }</a>`
    );
  });
  return result.join(separator);
}
hexo.extend.helper.register("tagcloud_lang", function (tags, options) {
  const transformArgs = () => {
    if (
      !options &&
      (!tags || !Object.prototype.hasOwnProperty.call(tags, "length"))
    ) {
      options = tags;
      tags = this.site.tags;
    }
    tags = tags;
    return [tags.toArray(), options];
  };
  return moize(tagcloudHelper.bind(this), {
    maxSize: 5,
    isDeepEqual: true,
    transformArgs,
  }).call(this, tags, options);
});

// https://github.com/hexojs/hexo/blob/master/lib/plugins/helper/list_archives.ts
function _toMomentLocale(lang) {
  if (lang === undefined) {
      return undefined;
  }
  if (!lang || lang === 'en' || lang === 'default') {
      return 'en';
  }
  return lang.toLowerCase().replace('_', '-');
}
const toMomentLocale = moize.shallow(_toMomentLocale)
function listArchivesHelper(options = {}) {
  const { config } = this;
  const archiveDir = config.archive_dir;
  const { timezone } = config;
  const lang = toMomentLocale(
    this.page.lang || this.page.language || config.language
  );
  let { format } = options;
  const type = options.type || "monthly";
  const { style = "list", transform, separator = ", " } = options;
  const showCount = Object.prototype.hasOwnProperty.call(options, "show_count")
    ? options.show_count
    : true;
  const className = options.class || "archive";
  const order = options.order || -1;
  const compareFunc =
    type === "monthly"
      ? (yearA, monthA, yearB, monthB) => yearA === yearB && monthA === monthB
      : (yearA, monthA, yearB, monthB) => yearA === yearB;
  let result = "";
  if (!format) {
    format = type === "monthly" ? "MMMM YYYY" : "YYYY";
  }
  const posts = this.site.posts.sort("date", order).filter((item) => !item.lang);
  if (!posts.length) return result;
  const data = [];
  let length = 0;
  posts.forEach((post) => {
    // Clone the date object to avoid pollution
    let date = post.date.clone();
    if (timezone) date = date.tz(timezone);
    const year = date.year();
    const month = date.month() + 1;
    const lastData = data[length - 1];
    if (!lastData || !compareFunc(lastData.year, lastData.month, year, month)) {
      if (lang) date = date.locale(lang);
      const name = date.format(format);
      length = data.push({
        name,
        year,
        month,
        count: 1,
      });
    } else {
      lastData.count++;
    }
  });
  const link = (item) => {
    let url = `${archiveDir}/${item.year}/`;
    if (type === "monthly") {
      if (item.month < 10) url += "0";
      url += `${item.month}/`;
    }
    return this.url_for_lang(url);
  };
  if (style === "list") {
    result += `<ul class="${className}-list">`;
    for (let i = 0, len = data.length; i < len; i++) {
      const item = data[i];
      result += `<li class="${className}-list-item">`;
      result += `<a class="${className}-list-link" href="${link(item)}">`;
      result += transform ? transform(item.name) : item.name;
      result += "</a>";
      if (showCount) {
        result += `<span class="${className}-list-count">${item.count}</span>`;
      }
      result += "</li>";
    }
    result += "</ul>";
  } else {
    for (let i = 0, len = data.length; i < len; i++) {
      const item = data[i];
      if (i) result += separator;
      result += `<a class="${className}-link" href="${link(item)}">`;
      result += transform ? transform(item.name) : item.name;
      if (showCount) {
        result += `<span class="${className}-count">${item.count}</span>`;
      }
      result += "</a>";
    }
  }
  return result;
}
hexo.extend.helper.register("list_archives_lang", listArchivesHelper);