import random
import math

locations = ['Pinheiros', 'Vila Madalena', 'Jardins', 'Moema', 'Brooklin', 'Itaim Bibi', 'Vila Mariana', 'Tatuapé', 'Santana', 'Liberdade']
info = {'Pinheiros': {'price_range':2.5, 'avg_price': 2_000_000, 'leads_per_month': 5, 'realtors_profit': 0.02, 'our_sell_price': 300, 'booked_lead_price': 180, 'avg_realtor_conversion': 2, 'realtor_conversion_range':2}, 
        'Vila Madalena': {'price_range':3.0, 'avg_price': 2_500_000, 'leads_per_month': 2, 'realtors_profit': 0.025, 'our_sell_price': 350, 'booked_lead_price': 200, 'avg_realtor_conversion': 2.5, 'realtor_conversion_range':2.5},
        'Jardins': {'price_range':3.5, 'avg_price': 3_000_000, 'leads_per_month': 5, 'realtors_profit': 0.03, 'our_sell_price': 400, 'booked_lead_price': 220, 'avg_realtor_conversion': 3, 'realtor_conversion_range':3},
        'Moema': {'price_range':2.0, 'avg_price': 1_800_000, 'leads_per_month': 10, 'realtors_profit': 0.015, 'our_sell_price': 280, 'booked_lead_price': 160, 'avg_realtor_conversion': 1.5, 'realtor_conversion_range':1.5},
        'Brooklin': {'price_range':2.8, 'avg_price': 2_200_000, 'leads_per_month': 18, 'realtors_profit': 0.022, 'our_sell_price': 320, 'booked_lead_price': 190, 'avg_realtor_conversion': 2.2, 'realtor_conversion_range':2.2},
        'Itaim Bibi': {'price_range':3.2, 'avg_price': 2_800_000, 'leads_per_month': 22, 'realtors_profit': 0.028, 'our_sell_price': 380, 'booked_lead_price': 210, 'avg_realtor_conversion': 2.8, 'realtor_conversion_range':2.8},
        'Vila Mariana': {'price_range':2.6, 'avg_price': 2_100_000, 'leads_per_month': 16, 'realtors_profit': 0.018, 'our_sell_price': 290, 'booked_lead_price': 170, 'avg_realtor_conversion': 1.8, 'realtor_conversion_range':1.8},
        'Tatuapé': {'price_range':2.4, 'avg_price': 1_900_000, 'leads_per_month': 12, 'realtors_profit': 0.016, 'our_sell_price': 270, 'booked_lead_price': 150, 'avg_realtor_conversion': 1.6, 'realtor_conversion_range':1.6},
        'Santana': {'price_range':2.3, 'avg_price': 1_750_000, 'leads_per_month': 14, 'realtors_profit': 0.017, 'our_sell_price': 260, 'booked_lead_price': 140, 'avg_realtor_conversion': 1.7, 'realtor_conversion_range':1.7},
        'Liberdade': {'price_range':2.1, 'avg_price': 1_600_000, 'leads_per_month': 8, 'realtors_profit': 0.014, 'our_sell_price': 250, 'booked_lead_price': 130, 'avg_realtor_conversion': 1.4, 'realtor_conversion_range':1.4}
       }

realtor1 = {'loc':['Pinheiros', 'Vila Madalena', 'Jardins'], 'name':'João', 'bought_leads': 10, 'got_leads': 0, 'last_received_time': 0}
realtor2 = {'loc':['Moema', 'Brooklin', 'Itaim Bibi'], 'name':'Maria', 'bought_leads': 12, 'got_leads': 0, 'last_received_time': 0}
realtor3 = {'loc':['Vila Mariana', 'Tatuapé', 'Santana'], 'name':'Carlos', 'bought_leads': 8, 'got_leads': 0, 'last_received_time': 0}
realtor4 = {'loc':['Liberdade', 'Pinheiros', 'Jardins'], 'name':'Ana', 'bought_leads': 90, 'got_leads': 0, 'last_received_time': 0}
realtor5 = {'loc':['Moema', 'Itaim Bibi', 'Brooklin'], 'name':'Pedro', 'bought_leads': 11, 'got_leads': 0, 'last_received_time': 0}
realtor6 = {'loc':['Vila Mariana', 'Santana', 'Tatuapé'], 'name':'Fernanda', 'bought_leads': 7, 'got_leads': 0, 'last_received_time': 0}
realtor7 = {'loc':['Jardins', 'Pinheiros', 'Liberdade'], 'name':'Roberto', 'bought_leads': 10, 'got_leads': 0, 'last_received_time': 0}
realtors = [realtor1, realtor2, realtor3, realtor4, realtor5, realtor6, realtor7]

for i in range(1, 80):
    lead = i
    location = random.choice(locations)

    scores = []               
    for realtor in realtors:
        if location in realtor['loc'] and realtor['got_leads'] < realtor['bought_leads']:
            t_i = i - realtor['last_received_time']
            I = 1 * (1 - realtor['got_leads'] / (realtor['bought_leads'] + 1)) + 0.5 * math.log(t_i + 1)
            scores.append((realtor['name'], I))

    print('\n\n')
    if not scores:
        print(f"Lead {lead} in {location} could not be assigned")
    else:
        max_score = max(scores, key=lambda x: x[1])
        print(f"Lead {lead} assigned to {max_score[0]} with I {max_score[1]:.2f} in {location}")
        for realtor in realtors:
            if realtor['name'] == max_score[0]:
                realtor['got_leads'] += 1
                realtor['last_received_time'] = i
                break




    for realtor in realtors:
        print(f"{realtor['name']} - Bought Leads: {realtor['bought_leads']}, Got Leads: {realtor['got_leads']}, Locations: {', '.join(realtor['loc'])}")