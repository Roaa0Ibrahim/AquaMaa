# AquaMaa gaps report

95 saved answers read from 2026-11-13.

## no_information: 18
Fix: Add a knowledge card (fastpath/data/knowledge_cards.csv) or a source to database/, then rebuild

- **How many groundwater wells are there in Qatar?** (29.9 s, deep path): The number of groundwater wells in Qatar is not explicitly stated in the provided sources. However, it is mentioned that there are 4,564 wells on farms (working and not working) in 2023 [number-of-far
- **How many wells on the dashboard meet the TDS threshold?** (18.7 s, deep path): The sources do not provide specific information about how many wells on the dashboard meet the TDS threshold.
- **ماذا تعني ملوحة 2000 ملغم/لتر لمزرعتي؟** (64.7 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.
- **Can my camels drink the water from my farm well?** (71.1 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.
- **هل أزرع الشعير أم الطماطم إذا كان ماء البئر مالحًا؟** (68.8 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.
- **كم عدد الآبار في مزارع بلدية الخور؟** (19.3 s, deep path): لا توجد معلومات متوفرة في المصادر عن عدد الآبار في مزارع بلدية الخور.
- **ما متوسط ملوحة مياه آبار المزارع في قطر؟** (42.8 s, deep path): لا توجد معلومات في المصادر عن متوسط ملوحة مياه آبار المزارع في قطر. توجد قيود على المياه بناءً على محتوى الأملاح الذائبة الكلية (TDS): المياه ذات TDS أقل من 450 ملغم/لتر لا توجد قيود عليها [limits.csv
- **كم درجة الحموضة في الماء الآن؟** (22.1 s, deep path): لا توجد قراءة حالية لدرجة الحموضة (pH) في الماء، لأن أجهزة الاستشعار لا تزال غير نشطة أو لا تقدم قراءات محدثة.
- **ليش ماي البير صار مالح؟** (74.6 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.
- **لماذا تزداد ملوحة مياه بئري؟** (49.3 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.
- **What is the salinity of the water right now** (6.8 s, fast path): The current salinity reading is not available due to insufficient data [live sensors]. There are no fresh valid values from the sensors, and the dashboard indicates insufficient data for monitoring [l
- **Which sensors need attention and which are offline right now** (4.7 s, fast path): The sensor AquaNova-ESP32-01 has been offline for 1994 minutes with no fresh valid values [live sensors]. The dashboard shows insufficient data and cannot provide drinking-water certification [live se
- **كم عدد الإضرار الموجودة في منطقة سدرية الخيسر؟ وهل المياه صالحة للشرب أم لا؟** (28.8 s, deep path): لا توجد معلومات متوفرة في المصادر عن عدد الإضرار في منطقة سدرية الخيسر. كما لا توجد معلومات متوفرة في المصادر عن جودة المياه في هذه المنطقة.
- **كيف اقيس جودة ماء البير** (43.6 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.

## wrong_language: 5
Fix: Check the language rule and the fixed messages (prompts.ARABIC_FIXED)

- **ماذا تعني ملوحة 2000 ملغم/لتر لمزرعتي؟** (64.7 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.
- **هل أزرع الشعير أم الطماطم إذا كان ماء البئر مالحًا؟** (68.8 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.
- **ليش ماي البير صار مالح؟** (74.6 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.
- **لماذا تزداد ملوحة مياه بئري؟** (49.3 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.
- **كيف اقيس جودة ماء البير** (43.6 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.

## slow: 35
Fix: Add example questions to fastpath/data/intent_questions.csv so the fast path recognises it

- **How many groundwater wells are there in Qatar?** (29.9 s, deep path): The number of groundwater wells in Qatar is not explicitly stated in the provided sources. However, it is mentioned that there are 4,564 wells on farms (working and not working) in 2023 [number-of-far
- **Can I irrigate tomatoes with brackish groundwater?** (39.6 s, deep path): You can irrigate salt-tolerant crops with brackish water if managed properly, as it is allowed under FAO 29's restriction levels [misconceptions.csv p.9]. However, using water with moderate to high sa
- **هل يمكن ري الطماطم بالمياه الجوفية المالحة؟** (44.8 s, deep path): لا، لا يمكن ري الطماطم بالمياه الجوفية المالحة بشكل مباشر دون معالجة، لأن المحتوى العالي من الملح (TDS) في المياه الجوفية المالحة قد يؤثر سلبًا على نمو النباتات ويزيد من خطر تراكم الملح في التربة [lim
- **What does a salinity of 2000 mg/L mean for my farm?** (66.9 s, deep path): A salinity of 2,000 mg/L is high for farming, as it can affect crops and soil [general knowledge]. You could choose salt-tolerant plants, which may grow slower, or use more water to wash salt away, wh
- **ماذا تعني ملوحة 2000 ملغم/لتر لمزرعتي؟** (64.7 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.
- **Should I switch my farm to drip irrigation?** (39.4 s, deep path): Switching to drip irrigation could help your farm use water more efficiently, as it sends water directly to plant roots and reduces waste [NPC_Water_Statistics_2023.txt p.41]. You could try drip irrig
- **هل أحوّل مزرعتي إلى الري بالتنقيط؟** (32.0 s, deep path): الري بالتنقيط يقلل من استخدام المياه، وهو أسلوب يُستخدم لتقديم الماء مباشرة إلى جذور النبات، مما يقلل من الهدر الناتج عن التبخر أو التسرب [general knowledge]. كما يساعد على تقليل كمية الماء المطلوبة ل
- **where is the most number of wells in qatar** (31.1 s, deep path): The municipality with the most wells in Qatar is Al Khor, with 1,621 wells in 2023 [number-of-farms-and-wells-by-type-of-the-farm-and-municipality.csv p.249]. You could visit Al Khor to see these well
- **أين يقع أكبر عدد من الابار في قطر** (30.0 s, deep path): الخور هي المدينة التي تحتوي على أكبر عدد من الابار، حيث بلغ عدد الابار 1,482 [number-of-farms-and-wells-by-type-of-the-farm-and-municipality.csv p.275].
- **My well water tastes saltier lately. Is it still okay for my date palms?** (49.1 s, deep path): Your well water tasting saltier is okay for date palms because they can handle salty water better than many other crops [glossary.csv p.21]. You should check the salinity levels to make sure they are 
- **هل يصلح ماء البئر لسقي النخيل إذا كانت ملوحته 3000 ملغم/لتر؟** (57.0 s, deep path): ماء البئر يصلح لسقي النخيل، لأن ملوحته 3000 ملغم/لتر، وهو أقل من الحد الأقصى المسموح به لسقي المحاصيل حسب معايير FAO 29، الذي يبلغ 2000 ملغم/لتر [limits.csv row 3]. يمكنك تحسين التربة أو استخدام مياه 
- **ليش ماي البير صار مالح؟** (34.6 s, deep path): ماء البئر قد يكون مالحًا لأن مياه الجوف في قطر تحتوي على ملح بكميات عالية [general knowledge].
- **Can my camels drink the water from my farm well?** (71.1 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.
- **Do I need a licence to dig a new well on my farm?** (24.0 s, deep path): Yes, you need a licence to dig a new well on your farm [ANND_Right_to_Water_in_Qatar.txt p.14].
- **هل أزرع الشعير أم الطماطم إذا كان ماء البئر مالحًا؟** (68.8 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.
- **How much groundwater do farms pump each year compared with the safe yield?** (39.1 s, deep path): Farms in Qatar pump 230 million m3 of groundwater each year, compared with a safe yield of 49.6 million m3 per year [PSA_Water_Statistics_2021.txt p.36] [NPC_Water_Statistics_2023.txt p.29]. The safe 
- **How many farms are working and how many are not working in each municipality?** (48.8 s, deep path): The number of farms not working in each municipality in 2023 is as follows: Doha has 0 farms [number-of-farms-and-wells-by-type-of-the-farm-and-municipality.csv p.255], Al Rayyan has 54 farms [number-
- **Should we restrict groundwater for fodder crops or subsidise drip irrigation on farms first?** (57.3 s, deep path): The text provided does not give specific data on groundwater use for fodder crops or drip irrigation subsidies [general knowledge]. It discusses irrigation methods, with drip being better than sprinkl
- **ما متوسط ملوحة مياه آبار المزارع في قطر؟** (42.8 s, deep path): لا توجد معلومات في المصادر عن متوسط ملوحة مياه آبار المزارع في قطر. توجد قيود على المياه بناءً على محتوى الأملاح الذائبة الكلية (TDS): المياه ذات TDS أقل من 450 ملغم/لتر لا توجد قيود عليها [limits.csv
- **What is the salinity of the water right now?** (25.6 s, deep path): There is no current measurement available for the salinity of the water [live sensors AquaNova-ESP32-01]. The average total dissolved solids (TDS) in the 201-well survey was 4,600 mg/L in 2020, but th
- **كم درجة الحموضة في الماء الآن؟** (22.1 s, deep path): لا توجد قراءة حالية لدرجة الحموضة (pH) في الماء، لأن أجهزة الاستشعار لا تزال غير نشطة أو لا تقدم قراءات محدثة.
- **لماذا تزداد ملوحة مياه بئري؟** (49.3 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.
- **ما المطلوب بين الآبار؟** (28.3 s, deep path): تُستخدم الآبار في قطر بشكل رئيسي لاستخراج المياه الجوفية، وهي مصدر مهم للمياه في الدولة [general knowledge]. توجد آبار في مناطق مختلفة من قطر، بما في ذلك في الأحواض الجوفية الرئيسية مثل الأحواض الشمال
- **كم عدد الإضرار الموجودة في منطقة سدرية الخيسر؟ وهل المياه صالحة للشرب أم لا؟** (28.8 s, deep path): لا توجد معلومات متوفرة في المصادر عن عدد الإضرار في منطقة سدرية الخيسر. كما لا توجد معلومات متوفرة في المصادر عن جودة المياه في هذه المنطقة.
- **كيف اقيس جودة ماء البير** (43.6 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.

## deep_path: 61
Fix: If it is a common question, give it a fast-path card or intent

- **كم عدد آبار المياه الجوفية في قطر** (18.1 s, deep path): عدد آبار المياه الجوفية في قطر يبلغ 4,564 آبار (2023) [number-of-farms-and-wells-by-type-of-the-farm-and-municipality.csv row 91].
- **How many groundwater wells are there in Qatar?** (29.9 s, deep path): The number of groundwater wells in Qatar is not explicitly stated in the provided sources. However, it is mentioned that there are 4,564 wells on farms (working and not working) in 2023 [number-of-far
- **where is the most number of wells in qatar** (18.8 s, deep path): The municipality with the most number of wells in Qatar is Al Khor, with 1,621 wells in 2023 [number-of-farms-and-wells-by-type-of-the-farm-and-municipality.csv p.249].
- **What does the dashboard show for groundwater extraction compared with the safe yield in 2022?** (11.7 s, deep path): The dashboard shows that groundwater extraction in 2022 was 250 MCM/year, while the safe yield was 49.6 MCM/year [dashboard overview 2022]. Extraction was 5.04 times the safe yield [dashboard overview
- **On the dashboard's sector chart, how much did agriculture extract in 2022 and what share is that?** (10.5 s, deep path): In 2022, agriculture extracted 155 MCM/year, which accounted for 62% of the total groundwater extraction [dashboard overview 2022]. These figures are marked as demonstration data [dashboard overview 2
- **According to the dashboard's trend chart, what was total extraction in 2010?** (10.6 s, deep path): According to the dashboard's trend chart, the total extraction in 2010 was 165 MCM/year [dashboard extraction 2010]. These figures are marked as demonstration data, sourced from the National water acc
- **How many wells on the dashboard meet the TDS threshold?** (18.7 s, deep path): The sources do not provide specific information about how many wells on the dashboard meet the TDS threshold.
- **What was the latest TDS reading at station ST-01 on the dashboard?** (13.9 s, deep path): The latest TDS reading at station ST-01 on the dashboard is 960 mg/L for October 2022 [dashboard readings ST-01 2022-10]. This figure is marked as demonstration data [dashboard readings ST-01 2022-10]
- **Can I irrigate tomatoes with brackish groundwater?** (39.6 s, deep path): You can irrigate salt-tolerant crops with brackish water if managed properly, as it is allowed under FAO 29's restriction levels [misconceptions.csv p.9]. However, using water with moderate to high sa
- **هل يمكن ري الطماطم بالمياه الجوفية المالحة؟** (44.8 s, deep path): لا، لا يمكن ري الطماطم بالمياه الجوفية المالحة بشكل مباشر دون معالجة، لأن المحتوى العالي من الملح (TDS) في المياه الجوفية المالحة قد يؤثر سلبًا على نمو النباتات ويزيد من خطر تراكم الملح في التربة [lim
- **What does a salinity of 2000 mg/L mean for my farm?** (66.9 s, deep path): A salinity of 2,000 mg/L is high for farming, as it can affect crops and soil [general knowledge]. You could choose salt-tolerant plants, which may grow slower, or use more water to wash salt away, wh
- **ماذا تعني ملوحة 2000 ملغم/لتر لمزرعتي؟** (64.7 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.
- **Should I switch my farm to drip irrigation?** (39.4 s, deep path): Switching to drip irrigation could help your farm use water more efficiently, as it sends water directly to plant roots and reduces waste [NPC_Water_Statistics_2023.txt p.41]. You could try drip irrig
- **هل أحوّل مزرعتي إلى الري بالتنقيط؟** (32.0 s, deep path): الري بالتنقيط يقلل من استخدام المياه، وهو أسلوب يُستخدم لتقديم الماء مباشرة إلى جذور النبات، مما يقلل من الهدر الناتج عن التبخر أو التسرب [general knowledge]. كما يساعد على تقليل كمية الماء المطلوبة ل
- **أين يقع أكبر عدد من الابار في قطر** (30.0 s, deep path): الخور هي المدينة التي تحتوي على أكبر عدد من الابار، حيث بلغ عدد الابار 1,482 [number-of-farms-and-wells-by-type-of-the-farm-and-municipality.csv p.275].
- **My well water tastes saltier lately. Is it still okay for my date palms?** (49.1 s, deep path): Your well water tasting saltier is okay for date palms because they can handle salty water better than many other crops [glossary.csv p.21]. You should check the salinity levels to make sure they are 
- **هل يصلح ماء البئر لسقي النخيل إذا كانت ملوحته 3000 ملغم/لتر؟** (57.0 s, deep path): ماء البئر يصلح لسقي النخيل، لأن ملوحته 3000 ملغم/لتر، وهو أقل من الحد الأقصى المسموح به لسقي المحاصيل حسب معايير FAO 29، الذي يبلغ 2000 ملغم/لتر [limits.csv row 3]. يمكنك تحسين التربة أو استخدام مياه 
- **ليش ماي البير صار مالح؟** (34.6 s, deep path): ماء البئر قد يكون مالحًا لأن مياه الجوف في قطر تحتوي على ملح بكميات عالية [general knowledge].
- **Can my camels drink the water from my farm well?** (71.1 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.
- **Do I need a licence to dig a new well on my farm?** (24.0 s, deep path): Yes, you need a licence to dig a new well on your farm [ANND_Right_to_Water_in_Qatar.txt p.14].
- **هل أزرع الشعير أم الطماطم إذا كان ماء البئر مالحًا؟** (68.8 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.
- **How much groundwater do farms pump each year compared with the safe yield?** (39.1 s, deep path): Farms in Qatar pump 230 million m3 of groundwater each year, compared with a safe yield of 49.6 million m3 per year [PSA_Water_Statistics_2021.txt p.36] [NPC_Water_Statistics_2023.txt p.29]. The safe 
- **How many farms are working and how many are not working in each municipality?** (48.8 s, deep path): The number of farms not working in each municipality in 2023 is as follows: Doha has 0 farms [number-of-farms-and-wells-by-type-of-the-farm-and-municipality.csv p.255], Al Rayyan has 54 farms [number-
- **كم عدد الآبار في مزارع بلدية الخور؟** (19.3 s, deep path): لا توجد معلومات متوفرة في المصادر عن عدد الآبار في مزارع بلدية الخور.
- **What is the penalty for a farm that digs a well without a licence?** (19.4 s, deep path): The penalty for a farm that digs a well without a licence in Qatar is up to three years in prison and up to 500,000 Qatari riyals in fines [ANND_Right_to_Water_in_Qatar.txt p.14]. This means unlicense
- **Should we restrict groundwater for fodder crops or subsidise drip irrigation on farms first?** (57.3 s, deep path): The text provided does not give specific data on groundwater use for fodder crops or drip irrigation subsidies [general knowledge]. It discusses irrigation methods, with drip being better than sprinkl
- **ما متوسط ملوحة مياه آبار المزارع في قطر؟** (42.8 s, deep path): لا توجد معلومات في المصادر عن متوسط ملوحة مياه آبار المزارع في قطر. توجد قيود على المياه بناءً على محتوى الأملاح الذائبة الكلية (TDS): المياه ذات TDS أقل من 450 ملغم/لتر لا توجد قيود عليها [limits.csv
- **What is the salinity of the water right now?** (25.6 s, deep path): There is no current measurement available for the salinity of the water [live sensors AquaNova-ESP32-01]. The average total dissolved solids (TDS) in the 201-well survey was 4,600 mg/L in 2020, but th
- **كم درجة الحموضة في الماء الآن؟** (22.1 s, deep path): لا توجد قراءة حالية لدرجة الحموضة (pH) في الماء، لأن أجهزة الاستشعار لا تزال غير نشطة أو لا تقدم قراءات محدثة.
- **لماذا تزداد ملوحة مياه بئري؟** (49.3 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.
- **ما المطلوب بين الآبار؟** (28.3 s, deep path): تُستخدم الآبار في قطر بشكل رئيسي لاستخراج المياه الجوفية، وهي مصدر مهم للمياه في الدولة [general knowledge]. توجد آبار في مناطق مختلفة من قطر، بما في ذلك في الأحواض الجوفية الرئيسية مثل الأحواض الشمال
- **الله أكبر عليك.** (4.7 s, deep path): هذا خارج مصادر AquaMaa. الله أكبر عليك، وعليك السلام. أتمنى أن تكون بخير.
- **كمية المياه الموجودة في البئر.** (15.9 s, deep path): لا توجد بيانات حالية عن كمية المياه في البئر. يُرجى مراجعة مصادر بيانات أخرى أو الاتصال بالجهات المعنية لمزيد من المعلومات [live sensors AquaNova-ESP32-01] offline, reported 1999 minutes ago: no fresh
- **كم عدد الإضرار الموجودة في منطقة سدرية الخيسر؟ وهل المياه صالحة للشرب أم لا؟** (28.8 s, deep path): لا توجد معلومات متوفرة في المصادر عن عدد الإضرار في منطقة سدرية الخيسر. كما لا توجد معلومات متوفرة في المصادر عن جودة المياه في هذه المنطقة.
- **كيف اقيس جودة ماء البير** (43.6 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.

## repaired: 35
Fix: Read the trace (python show_trace.py "words") to see which check failed

- **How many groundwater wells are there in Qatar?** (29.9 s, deep path): The number of groundwater wells in Qatar is not explicitly stated in the provided sources. However, it is mentioned that there are 4,564 wells on farms (working and not working) in 2023 [number-of-far
- **How many wells on the dashboard meet the TDS threshold?** (18.7 s, deep path): The sources do not provide specific information about how many wells on the dashboard meet the TDS threshold.
- **What was the latest TDS reading at station ST-01 on the dashboard?** (13.9 s, deep path): The latest TDS reading at station ST-01 on the dashboard is 960 mg/L for October 2022 [dashboard readings ST-01 2022-10]. This figure is marked as demonstration data [dashboard readings ST-01 2022-10]
- **Can I irrigate tomatoes with brackish groundwater?** (39.6 s, deep path): You can irrigate salt-tolerant crops with brackish water if managed properly, as it is allowed under FAO 29's restriction levels [misconceptions.csv p.9]. However, using water with moderate to high sa
- **What does a salinity of 2000 mg/L mean for my farm?** (66.9 s, deep path): A salinity of 2,000 mg/L is high for farming, as it can affect crops and soil [general knowledge]. You could choose salt-tolerant plants, which may grow slower, or use more water to wash salt away, wh
- **ماذا تعني ملوحة 2000 ملغم/لتر لمزرعتي؟** (64.7 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.
- **Should I switch my farm to drip irrigation?** (39.4 s, deep path): Switching to drip irrigation could help your farm use water more efficiently, as it sends water directly to plant roots and reduces waste [NPC_Water_Statistics_2023.txt p.41]. You could try drip irrig
- **هل أحوّل مزرعتي إلى الري بالتنقيط؟** (32.0 s, deep path): الري بالتنقيط يقلل من استخدام المياه، وهو أسلوب يُستخدم لتقديم الماء مباشرة إلى جذور النبات، مما يقلل من الهدر الناتج عن التبخر أو التسرب [general knowledge]. كما يساعد على تقليل كمية الماء المطلوبة ل
- **My well water tastes saltier lately. Is it still okay for my date palms?** (49.1 s, deep path): Your well water tasting saltier is okay for date palms because they can handle salty water better than many other crops [glossary.csv p.21]. You should check the salinity levels to make sure they are 
- **هل يصلح ماء البئر لسقي النخيل إذا كانت ملوحته 3000 ملغم/لتر؟** (57.0 s, deep path): ماء البئر يصلح لسقي النخيل، لأن ملوحته 3000 ملغم/لتر، وهو أقل من الحد الأقصى المسموح به لسقي المحاصيل حسب معايير FAO 29، الذي يبلغ 2000 ملغم/لتر [limits.csv row 3]. يمكنك تحسين التربة أو استخدام مياه 
- **ليش ماي البير صار مالح؟** (34.6 s, deep path): ماء البئر قد يكون مالحًا لأن مياه الجوف في قطر تحتوي على ملح بكميات عالية [general knowledge].
- **Can my camels drink the water from my farm well?** (71.1 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.
- **Do I need a licence to dig a new well on my farm?** (24.0 s, deep path): Yes, you need a licence to dig a new well on your farm [ANND_Right_to_Water_in_Qatar.txt p.14].
- **هل أزرع الشعير أم الطماطم إذا كان ماء البئر مالحًا؟** (68.8 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.
- **How much groundwater do farms pump each year compared with the safe yield?** (39.1 s, deep path): Farms in Qatar pump 230 million m3 of groundwater each year, compared with a safe yield of 49.6 million m3 per year [PSA_Water_Statistics_2021.txt p.36] [NPC_Water_Statistics_2023.txt p.29]. The safe 
- **Should we restrict groundwater for fodder crops or subsidise drip irrigation on farms first?** (57.3 s, deep path): The text provided does not give specific data on groundwater use for fodder crops or drip irrigation subsidies [general knowledge]. It discusses irrigation methods, with drip being better than sprinkl
- **ما متوسط ملوحة مياه آبار المزارع في قطر؟** (42.8 s, deep path): لا توجد معلومات في المصادر عن متوسط ملوحة مياه آبار المزارع في قطر. توجد قيود على المياه بناءً على محتوى الأملاح الذائبة الكلية (TDS): المياه ذات TDS أقل من 450 ملغم/لتر لا توجد قيود عليها [limits.csv
- **كم درجة الحموضة في الماء الآن؟** (22.1 s, deep path): لا توجد قراءة حالية لدرجة الحموضة (pH) في الماء، لأن أجهزة الاستشعار لا تزال غير نشطة أو لا تقدم قراءات محدثة.
- **لماذا تزداد ملوحة مياه بئري؟** (49.3 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.
- **ما المطلوب بين الآبار؟** (28.3 s, deep path): تُستخدم الآبار في قطر بشكل رئيسي لاستخراج المياه الجوفية، وهي مصدر مهم للمياه في الدولة [general knowledge]. توجد آبار في مناطق مختلفة من قطر، بما في ذلك في الأحواض الجوفية الرئيسية مثل الأحواض الشمال
- **كم عدد الإضرار الموجودة في منطقة سدرية الخيسر؟ وهل المياه صالحة للشرب أم لا؟** (28.8 s, deep path): لا توجد معلومات متوفرة في المصادر عن عدد الإضرار في منطقة سدرية الخيسر. كما لا توجد معلومات متوفرة في المصادر عن جودة المياه في هذه المنطقة.
- **كيف اقيس جودة ماء البير** (43.6 s, deep path): AquaMaa's sources don't contain enough evidence to answer this question.

## dialect: 0
Fix: Check that the rewrite into standard Arabic kept the meaning

