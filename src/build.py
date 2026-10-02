import io, os, re, sys

base = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(base)

with io.open(os.path.join(base, 'index.html'), 'r', encoding='utf-8') as f:
    html = f.read()
with io.open(os.path.join(base, 'app.js'), 'r', encoding='utf-8') as f:
    js = f.read()

tag = '<script src="./app.js"></script>'
assert tag in html, 'script tag not found'
# 防止内联脚本提前闭合
assert '</script' not in js.lower(), 'js contains closing script tag'

html = html.replace(tag, '<script>\n' + js + '\n</script>')

out = os.path.join(root, 'index.html')
with io.open(out, 'w', encoding='utf-8') as f:
    f.write(html)

print('merged ->', out)
print('bytes:', len(html.encode('utf-8')))
