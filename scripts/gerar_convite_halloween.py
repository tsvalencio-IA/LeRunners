from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

P = Path(__file__).resolve().parents[1] / 'assets' / 'fotos'
DARK = '#140e17'
ORANGE = '#ff8d34'
WHITE = '#fff9f0'
MUTED = '#d5bfd0'
regular = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
bold = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def font(sz, heavy=True):
    return ImageFont.truetype(bold if heavy else regular, sz)

def photo(name, w, h, fit='cover'):
    im = Image.open(P / name).convert('RGB')
    if fit == 'contain':
        base = Image.new('RGB', (w, h), '#161017')
        thumb = ImageOps.contain(im, (w, h), Image.Resampling.LANCZOS)
        base.paste(thumb, ((w-thumb.width)//2, (h-thumb.height)//2))
        return base
    return ImageOps.fit(im, (w, h), Image.Resampling.LANCZOS, centering=(.5, .5))

def label(draw, x, y, word, size, color=WHITE):
    draw.text((x, y), word, font=font(size), fill=color, stroke_width=0)

# Cartão de prévia: fotos de pessoas exatamente como os originais.
out = Image.new('RGB', (1200, 630), DARK)
d = ImageDraw.Draw(out)
d.rounded_rectangle((18,15,1182,610), radius=25, outline='#794329', width=3)
d.rounded_rectangle((42,38,355,81), radius=19, fill='#4b251a')
label(d,63,47,'01 DE NOVEMBRO • 2026',17,'#ffcf9b')
label(d,45,103,'HALLOWEEN',57,ORANGE)
label(d,49,179,'LeRunners',45)
label(d,49,245,'CONFRATERNIZAÇÃO DA EQUIPE',19,MUTED)
d.rounded_rectangle((43,312,470,363), radius=12, fill='#a64919')
label(d,69,327,'CONFIRME SUA PRESENÇA',20)
label(d,49,397,'HAMBÚRGUERES ARTESANAIS',18,WHITE)
label(d,49,434,'PISCINA • EQUIPE • HALLOWEEN',15,MUTED)
label(d,49,530,'01/11 • DOMINGO • CHÁCARA',18,ORANGE)
label(d,49,564,'VÉSPERA DO FERIADO DE FINADOS',13,MUTED)
out.paste(photo('76107.jpg',668,411,'contain'), (502,39))
out.paste(photo('302971.jpg',326,137), (502,459))
out.paste(photo('143240.jpg',332,137), (838,459))
d = ImageDraw.Draw(out)
for rect in [(500,37,1172,453),(500,457,832,598),(836,457,1172,598)]:
    d.rounded_rectangle(rect, radius=7, outline='#9b6a43', width=2)
out.save(P / 'convite-og.jpg', quality=88, optimize=True, subsampling=0)

# Convite vertical para compartilhar.
out = Image.new('RGB',(1080,1350),DARK)
d = ImageDraw.Draw(out)
d.rectangle((0,0,1080,20), fill=ORANGE)
d.rounded_rectangle((58,60,490,124), radius=25, fill='#553023')
label(d,82,79,'01 NOVEMBRO • DOMINGO',23,'#ffcf9b')
label(d,57,160,'HALLOWEEN',101,ORANGE)
label(d,63,286,'LeRunners',76)
label(d,64,396,'CONFRATERNIZAÇÃO DA EQUIPE',26,MUTED)
label(d,64,430,'VÉSPERA DO FERIADO DE FINADOS',18,'#ffcf9b')
out.paste(photo('76107.jpg',960,616,'contain'), (60,458))
out.paste(photo('302971.jpg',465,204), (60,1081))
out.paste(photo('143240.jpg',465,204), (555,1081))
d = ImageDraw.Draw(out)
for rect in [(57,455,1023,1077),(57,1078,529,1289),(552,1078,1023,1289)]:
    d.rounded_rectangle(rect, radius=13, outline='#9b6a43', width=3)
out.save(P / 'convite-whatsapp.jpg',quality=87,optimize=True,subsampling=0)
print('Convites para domingo, 01/11/2026, gerados com as fotografias originais.')
