"""Arabic answers in Arabic only, and Arabic text ready to be spoken (14 Nov, Roaa: "when it's Arabic make it only
Arabic", and the voice must pronounce units like ملغم).

arabic_only(answer): for an answer to an Arabic question, in what the person reads
  - English terms become their Arabic names (TDS -> الأملاح الذائبة, pH -> درجة الحموضة, mg/L -> ملغم/لتر ...)
  - the inline source tags ([live sensors], [limits.csv row 2 (FAO 29)] ...) are taken out of the sentences and listed
    once at the end, by Arabic names: «المصادر: قراءات الحساس المباشرة، منظمة الأغذية والزراعة (الفاو)»
    (the website still gets the original tags from the answer's "sources" field, read before this step)
speakable_ar(text): Arabic text for the voice: units and abbreviations written out as words, so «ملغم/لتر» is said
  «مليغرام لكل لتر», and 1,800 is read as one number.
"""
import re

TERMS = [  # English or abbreviated -> Arabic, in this order (longer first)
    (r"\bmg\s*/\s*L\b", "ملغم/لتر"), (r"\bmg/l\b", "ملغم/لتر"), (r"ملغ\s*/\s*لتر", "ملغم/لتر"), (r"ملجم\s*/\s*لتر", "ملغم/لتر"),
    (r"µS\s*/\s*cm", "ميكروسيمنز/سم"), (r"\bdS\s*/\s*m\b", "ديسيسيمنز/م"),
    (r"\bppm\b", "جزء في المليون"), (r"°\s*C\b", "درجة مئوية"), (r"\bNTU\b", "وحدة عكارة"),
    (r"\(\s*(TDS|EC|ECw|pH)\s*\)", ""),                       # "الأملاح الذائبة (TDS)": the Arabic name is enough
    (r"\bTDS\b", "الأملاح الذائبة"), (r"\bECw\b", "ملوحة مياه الري"), (r"\bEC\b", "التوصيل الكهربائي"),
    (r"\bpH\b", "درجة الحموضة"), (r"\bWHO\b", "منظمة الصحة العالمية"), (r"\bFAO\b", "الفاو"),
]
REPEATS = [(r"(درجة الحموضة)\s+درجة الحموضة", r"\1"), (r"(الأملاح الذائبة)\s+الأملاح الذائبة", r"\1"),
           (r"(التوصيل الكهربائي)\s+التوصيل الكهربائي", r"\1")]

SOURCE_NAMES = [  # a source tag (lower case) contains ... -> its Arabic name
    ("live sensors", "قراءات الحساس المباشرة"), ("this page", "هذه الصفحة"), ("aquamaa check", "فحص أكوا ماء"),
    ("aquamaa place", "قائمة مناطق أكوا ماء"), ("fao", "منظمة الأغذية والزراعة (الفاو)"),
    ("limits.csv", "منظمة الأغذية والزراعة (الفاو)"), ("who", "منظمة الصحة العالمية"),
    ("farms-and-wells", "تعداد المزارع"), ("farm census", "تعداد المزارع"), ("psa", "جهاز التخطيط والإحصاء"),
    ("npc", "جهاز التخطيط والإحصاء"), ("kahramaa", "كهرماء"), ("law", "قانون المياه في قطر"),
    ("dfrobot", "دليل الحساس"), ("misconceptions", "معرفة أكوا ماء"), ("glossary", "معرفة أكوا ماء"),
    ("elobaid", "دراسة جبهة الملوحة في شمال قطر"), ("dashboard", "لوحة المعلومات"),
]
TAG = re.compile(r"\s*\[([^\]]+)\]")


def arabic_only(answer):
    names = []
    for tag in TAG.findall(answer):
        for part in re.split(r"\s*;\s*", tag):
            low = part.lower()
            name = next((ar for key, ar in SOURCE_NAMES if key in low), "مصادر أكوا ماء")
            if name not in names:
                names.append(name)
    text = TAG.sub("", answer)
    text = re.sub(r"\s*\[[^\]]*$", "", text)     # 15 Nov: a source tag cut off at the end left a stray "["
    for pattern, ar in TERMS:
        text = re.sub(pattern, ar, text, flags=re.I if pattern.startswith(r"\bmg/l") else 0)
    for pattern, ar in REPEATS:
        text = re.sub(pattern, ar, text)
    text = re.sub(r"[ \t]+([.،؛,])", r"\1", re.sub(r"[ \t]{2,}", " ", text)).strip()
    return text + (f"\n\nالمصادر: {'، '.join(names)}" if names else "")


SPOKEN = [  # written forms -> how they are said
    (r"ملغم\s*/\s*لتر", "مليغرام لكل لتر"), (r"ملغم(?![ء-ي])", "مليغرام"), (r"ميكروسيمنز\s*/\s*سم", "ميكروسيمنز لكل سنتيمتر"),
    (r"ديسيسيمنز\s*/\s*م", "ديسيسيمنز لكل متر"), (r"(\d),(?=\d{3}\b)", r"\1"), (r"(\d)\s*%", r"\1 بالمئة"),
    (r"(\d)\s*-\s*(\d)", r"\1 إلى \2"),
]


def speakable_ar(text):
    text = arabic_only(text).split("\n\nالمصادر:")[0]        # the source list is for reading, not for the voice
    for pattern, said in SPOKEN:
        text = re.sub(pattern, said, text)
    return re.sub(r"\s+", " ", text).strip()


if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    a = ("ملوحة الماء (TDS) 1,800 ملغم/لتر [live sensors]، ودرجة الحموضة pH 7.2 [live sensors]. يناسب النخيل "
         "حتى 4-5 ديسيسيمنز/م [limits.csv row 2 (FAO 29)] [FAO 29 Table 4].")
    print(arabic_only(a), "\n---\n", speakable_ar(a))
