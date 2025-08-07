import random



def bought_credits(realtor, class_range):
    realtor['class_range'] = class_range + realtor['remaning_credits']
    realtor['remaning_credits'] = realtor['class_range']





ranges = [{'class_range': [1, 5], 'leads_per_day': 1},
            {'class_range': [6, 10], 'leads_per_day': 2},
            {'class_range': [11, 20], 'leads_per_day': 3},
            {'class_range': [21, 40], 'leads_per_day': 4},
            {'class_range': [41, 999_999_999], 'leads_per_day': 5}]


realtor1 = {'name':'João', 'class_range': 10, 'remaning_credits': 10}
realtor2 = {'name':'Maria', 'class_range': 12, 'remaning_credits': 12}
realtor3 = {'name':'Carlos', 'class_range': 8, 'remaning_credits': 8}
realtor4 = {'name':'Ana', 'class_range': 90, 'remaning_credits': 90}
realtor5 = {'name':'Pedro', 'class_range': 11, 'remaning_credits': 11}
realtor6 = {'name':'Fernanda', 'class_range': 7, 'remaning_credits': 7}
realtor7 = {'name':'Roberto', 'class_range': 10, 'remaning_credits': 10}

realtors = [realtor1, realtor2, realtor3, realtor4, realtor5, realtor6, realtor7]

ads = []
for realtor in realtors:
    ads.append({'budget': 0,'duration_left':0, 'name': realtor['name']})

for h in range(0, 24*6):
    print(f"\n--- hour: {h} ---")
    total_credits = 0
    for ad in ads:
        if ad['budget'] > 0:
            ad['duration_left'] -= 1
        total_credits += ad['budget']
    print(f"Total credits at the start of the hour: {total_credits}")
    
    for realtor in realtors:
        if h == 114 and realtor['name'] == 'Fernanda':
            bought_credits(realtor, 10)
            
        for ad in ads:

            if ad['name'] == realtor['name']:
                if ad['duration_left'] <= 0:

                    for r in ranges:
                        if realtor['class_range'] >= r['class_range'][0] and realtor['class_range'] <= r['class_range'][1]:
                            input_credit = 0
                            if realtor['remaning_credits'] >= r['leads_per_day']:
                                realtor['remaning_credits'] -= r['leads_per_day']
                                input_credit = r['leads_per_day']
                                
                                
                            else:
                                realtor['remaning_credits'] = 0
                                input_credit = realtor['remaning_credits']

                            print(f"Ad for {realtor['name']} updated with {input_credit} credits")
                            if input_credit > 0:
                                ad['duration_left'] = 24
                            ad['budget'] = input_credit
                            break













