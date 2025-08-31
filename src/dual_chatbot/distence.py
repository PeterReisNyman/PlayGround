real_estate_types = [
    "Andar corrido",
    "Apartamento",
    "Apartamento padrão",
    "Armazém",
    "Bangalô",
    "Box",
    "Casa",
    "Casa de alvenaria",
    "Casa de condomínio",
    "Casa de praia",
    "Casa de vila",
    "Casa geminada",
    "Casa térrea",
    "Casas de alto padrão",
    "Casas em condomínios fechados",
    "Chalé",
    "Chácara",
    "Cobertura",
    "Conjunto Comercial",
    "Depósito",
    "Duplex",
    "Edifício de apartamentos",
    "Edícula",
    "Fazenda",
    "Flat",
    "Galpão",
    "Galpões industriais",
    "Garagem",
    "Garden",
    "Hotel",
    "Imóveis na planta",
    "Imóveis rurais",
    "Kitnet",
    "Loft",
    "Loja",
    "Lote",
    "Mansão",
    "Palafita",
    "Pau a pique",
    "Penthouse",
    "Pousada",
    "Prédio comercial",
    "Quitinete",
    "Sala",
    "Sala comercial",
    "Salão",
    "Sítio",
    "Sobrado",
    "Studio",
    "Terreno",
    "Terreno em condomínio",
    "Tiny houses",
    "Triplex"
]



change the way the property_types jsonb, are created in the database.
insted when the realtor creates adds a neighborhoods, make it so that it must be a key from the predefined list.
so these fileds should now be an array of enum instead of jsonb. return the closest match from the predefined list if there is a typo.

neighborhoods jsonb, on the other hand should be an array of enum from a predefined list bairros of neighborhoods, but if the realtor or leads adds a neighborhood that is not in the predefined list, it should add it to this list 


remove the clean and desplaiy text form both as now it should only show the dispalay text.
remove the concept_groups table and all references to it as it is no longer needed.

remove the backend/src/utils/similarity.ts 

create an new function for the agent to add new neighborhoods.

create 2 sperate levenshtein_similarity functions one for the neighborhoods and one for the property types.
if the similarity is above 0.8 for the bairro then dont add it and use the existing one. otherwise retrun the closest match, and ask the agent if no of them is matching the users bairro input then he should add it, with no numbers and to have capitalization. then the add new neighborhoods should be provided to the agent for that round.



if a relaotor worte Casa, then a lead that writes ["Bangalô", "Casa de alvenaria", "Casa de condomínio", "Casa de praia", "Casa de vila", "Casa geminada", "Casa térrea", "Casas de alto padrão", "Casas em condomínios fechados", "Chalé", "Chácara", "Edícula", "Mansão", "Palafita", "Pau a pique", "Sobrado", "Tiny houses"], or "Casa" should be considered a match.

real_estate_relationships = {
    "Andar corrido": ["Apartamento", "Apartamento padrão"],
    "Apartamento": ["Andar corrido", "Apartamento padrão", "Cobertura", "Duplex", "Flat", "Garden", "Kitnet", "Loft", "Penthouse", "Quitinete", "Studio", "Triplex"],
    "Apartamento padrão": ["Andar corrido", "Apartamento"],
    "Armazém": ["Depósito", "Galpão", "Galpões industriais"],
    "Bangalô": ["Casa", "Casa térrea", "Chalé"],
    "Box": ["Conjunto Comercial", "Garagem", "Sala", "Sala comercial"],
    "Casa": ["Bangalô", "Casa de alvenaria", "Casa de condomínio", "Casa de praia", "Casa de vila", "Casa geminada", "Casa térrea", "Casas de alto padrão", "Casas em condomínios fechados", "Chalé", "Chácara", "Edícula", "Mansão", "Palafita", "Pau a pique", "Sobrado", "Tiny houses"],
    "Casa de alvenaria": ["Casa", "Pau a pique"],
    "Casa de condomínio": ["Casa", "Casas em condomínios fechados", "Terreno em condomínio"],
    "Casa de praia": ["Casa", "Chalé", "Palafita"],
    "Casa de vila": ["Casa", "Casa geminada"],
    "Casa geminada": ["Casa", "Casa de vila"],
    "Casa térrea": ["Bangalô", "Casa", "Garden", "Tiny houses"],
    "Casas de alto padrão": ["Casa", "Cobertura", "Mansão", "Penthouse"],
    "Casas em condomínios fechados": ["Casa", "Casa de condomínio"],
    "Chalé": ["Bangalô", "Casa", "Casa de praia"],
    "Chácara": ["Casa", "Imóveis rurais", "Pousada", "Sítio"],
    "Cobertura": ["Apartamento", "Casas de alto padrão", "Penthouse"],
    "Conjunto Comercial": ["Box", "Garagem", "Prédio comercial", "Sala", "Sala comercial"],
    "Depósito": ["Armazém", "Galpão", "Galpões industriais"],
    "Duplex": ["Apartamento", "Sobrado", "Triplex"],
    "Edifício de apartamentos": ["Apartamento", "Prédio comercial"],
    "Edícula": ["Casa", "Tiny houses"],
    "Fazenda": ["Imóveis rurais", "Sítio"],
    "Flat": ["Apartamento", "Hotel"],
    "Galpão": ["Armazém", "Depósito", "Galpões industriais"],
    "Galpões industriais": ["Armazém", "Depósito", "Galpão"],
    "Garagem": ["Box", "Conjunto Comercial", "Sala", "Sala comercial"],
    "Garden": ["Apartamento", "Casa térrea"],
    "Hotel": ["Flat", "Pousada"],
    "Imóveis na planta": ["Apartamento", "Casa", "Terreno"],
    "Imóveis rurais": ["Chácara", "Fazenda", "Sítio"],
    "Kitnet": ["Apartamento", "Quitinete", "Studio"],
    "Loft": ["Apartamento", "Studio"],
    "Loja": ["Sala comercial", "Salão"],
    "Lote": ["Terreno"],
    "Mansão": ["Casa", "Casas de alto padrão"],
    "Palafita": ["Casa", "Casa de praia"],
    "Pau a pique": ["Casa", "Casa de alvenaria"],
    "Penthouse": ["Apartamento", "Casas de alto padrão", "Cobertura"],
    "Pousada": ["Chácara", "Hotel"],
    "Prédio comercial": ["Conjunto Comercial", "Edifício de apartamentos", "Sala"],
    "Quitinete": ["Apartamento", "Kitnet", "Studio"],
    "Sala": ["Box", "Conjunto Comercial", "Garagem", "Prédio comercial", "Sala comercial"],
    "Sala comercial": ["Box", "Conjunto Comercial", "Garagem", "Loja", "Sala", "Salão"],
    "Salão": ["Loja", "Sala comercial"],
    "Sítio": ["Chácara", "Fazenda", "Imóveis rurais"],
    "Sobrado": ["Casa", "Duplex"],
    "Studio": ["Apartamento", "Kitnet", "Loft", "Quitinete"],
    "Terreno": ["Imóveis na planta", "Lote", "Terreno em condomínio"],
    "Terreno em condomínio": ["Casa de condomínio", "Terreno"],
    "Tiny houses": ["Casa", "Casa térrea", "Edícula"],
    "Triplex": ["Apartamento", "Duplex"]
}

bairros = ['Água Branca', 'Alto de Pinheiros', 'Aricanduva', 'Barragem', 'Bela Vista', 'Belenzinho', 'Bom Retiro', 'Brás', 'Brasilândia', 'Cambuci', 'Campo Belo', 'Campo Grande', 'Campos Elíseos', 'Canindé', 'Capelinha', 'Casa Verde', 'Catumbi', 'Cerqueira César', 'Cidade Jardim', 'Cidade Tiradentes', 'Colônia', 'Corisco', 'Engenho Velho', 'Ferreira', 'Freguesia do Ó', 'Furnas', 'Glicério', 'Grajaú', 'Granja Julieta', 'Guarapiranga', 'Higienópolis', 'Indianópolis', 'Interlagos', 'Ipiranga', 'Itaim Bibi', 'Jaraguá', 'Jardim Amália', 'Jardim América', 'Jardim Boa Vista', 'Jardim Europa', 'Jardim Iva', 'Jardim Marajoara', 'Jardim Paulista', 'Jardim Vera Cruz', 'Jardim Vista Alegre', 'Lapa', 'Liberdade', 'Luz', 'Mandaqui', 'Mercado', 'Mirandópolis', 'Moema', 'Mooca', 'Pacaembu', 'Paraíso', 'Paraisópolis', 'Parque Continental', 'Parque Vitória', 'Perdizes', 'Piraporinha', 'Planalto Paulista', 'República', 'Sacomã', 'Santa Cecília', 'Santa Ifigênia', 'Santa Teresinha', 'Santana', 'Sé', 'Sumaré', 'Tatuapé', 'Tucuruvi', 'Vila Cachoeira', 'Vila Celeste', 'Vila Conceição', 'Vila Cruzeiro', 'Vila Esperança', 'Vila Formosa', 'Vila Guilherme', 'Vila Maria', 'Vila Mariana', 'Vila Medeiros', 'Vila Pompeia', 'Vila Rica', 'Vila Santa Isabel', 'Vila Sônia', 'Jardim Ângela', 'Capão Redondo', 'Sapopemba', 'Jardim São Luís', 'Cidade Ademar', 'Campo Limpo', 'Jabaquara', 'Itaquera', 'Itaim Paulista', 'Tremembé', 'Cidade Dutra', 'Pirituba', 'Vila Andrade', 'Lajeado', 'Pedreira', 'São Mateus', 'Parelheiros', 'Iguatemi', 'São Rafael', 'Cachoeirinha', 'Cangaíba', 'Vila Curuçá', 'São Lucas', 'Cidade Líder', 'Vila Jacuí', 'Penha', 'Rio Pequeno', 'Jardim Helena', 'Saúde', 'José Bonifácio', 'Raposo Tavares', 'Ermelino Matarazzo', 'Guaianases', 'Vila Prudente', 'Vila Matilde', 'Cursino', 'Artur Alvim', 'Ponte Rasa', 'São Domingos', 'Perus', 'Jaçanã', 'Água Rasa', 'Santo Amaro', 'Carrão', 'Limão', 'São Miguel', 'Anhanguera', 'Parque do Carmo', 'Pinheiros', 'Belém', 'Jaguaré', 'Consolação', 'Butantã', 'Vila Leopoldina', 'Morumbi', 'Socorro', 'Barra Funda', 'Jaguara', 'Pari', 'Marsilac']





bairros_A = ["Adamantina", "Adolfo", "Aguaí", "Águas da Prata", "Águas de Lindóia", "Águas de Santa Bárbara", "Águas de São Pedro", "Agudos", "Alambari", "Alfredo Marcondes", "Altair", "Altinópolis", "Alto Alegre", "Alumínio", "Álvaro de Carvalho", "Alvinlândia", "Americana", "Américo Brasiliense", "Américo de Campos", "Amparo", "Analândia", "Andradina", "Angatuba", "Anhembi", "Anhumas", "Aparecida", "Aparecida d'Oeste", "Apiaí", "Araçariguama", "Araçatuba", "Araçoiaba da Serra", "Aramina", "Arandu", "Arapeí", "Araraquara", "Araras", "Arco-Íris", "Arealva", "Areias", "Areiópolis", "Ariranha", "Artur Nogueira", "Arujá", "Aspásia", "Assis", "Atibaia", "Auriflama", "Avaí", "Avanhandava", "Avaré", "Bady Bassitt", "Balbinos", "Bálsamo", "Bananal", "Barão de Antonina", "Barbosa", "Bariri", "Barra Bonita", "Barra do Chapéu", "Barra do Turvo", "Barretos", "Barrinha", "Barueri", "Bastos", "Batatais", "Bauru", "Bebedouro", "Bento de Abreu", "Bernardino de Campos", "Bertioga", "Bilac", "Birigui", "Biritiba Mirim", "Boa Esperança do Sul", "Bocaina", "Bofete", "Boituva", "Bom Jesus dos Perdões", "Bom Sucesso de Itararé", "Borá", "Boraceia", "Borborema", "Borebi", "Botucatu", "Bragança Paulista", "Braúna", "Brejo Alegre", "Brodowski", "Brotas", "Buri", "Buritama", "Buritizal", "Cabrália Paulista", "Cabreúva", "Caçapava", "Cachoeira Paulista", "Caconde", "Cafelândia", "Caiabu", "Caieiras", "Caiuá", "Cajamar", "Cajati", "Cajobi", "Cajuru", "Campina do Monte Alegre", "Campinas", "Campo Limpo Paulista", "Campos do Jordão", "Campos Novos Paulista", "Cananéia", "Canas", "Cândido Mota", "Cândido Rodrigues", "Canitar", "Capão Bonito", "Capela do Alto", "Capivari", "Caraguatatuba", "Carapicuíba", "Cardoso", "Casa Branca", "Cássia dos Coqueiros", "Castilho", "Catanduva", "Catiguá", "Cedral", "Cerqueira César", "Cerquilho", "Cesário Lange", "Charqueada", "Chavantes", "Clementina", "Colina", "Colômbia", "Conchal", "Conchas", "Cordeirópolis", "Coroados", "Coronel Macedo", "Corumbataí", "Cosmópolis", "Cosmorama", "Cotia", "Cravinhos", "Cristais Paulista", "Cruzália", "Cruzeiro", "Cubatão", "Cunha", "Descalvado", "Dirce Reis", "Divinolândia", "Dobrada", "Dois Córregos", "Dolcinópolis", "Dourado", "Dracena", "Duartina", "Dumont", "Echaporã", "Eldorado", "Elias Fausto", "Elisiário", "Embaúba", "Embu das Artes", "Embu-Guaçu", "Emilianópolis", "Engenheiro Coelho", "Espírito Santo do Pinhal", "Espírito Santo do Turvo", "Estiva Gerbi", "Estrela d'Oeste", "Estrela do Norte", "Euclides da Cunha Paulista", "Fartura", "Fernando Prestes", "Fernandópolis", "Fernão", "Ferraz de Vasconcelos", "Flora Rica", "Floreal", "Flórida Paulista", "Florínea", "Franca", "Francisco Morato", "Franco da Rocha", "Gábriel Monteiro", "Gália", "Garça", "Gastão Vidigal", "Gavião Peixoto", "General Salgado", "Getulina", "Glicério", "Guaiçara", "Guaimbê", "Guaíra", "Guapiaçu", "Guapiara", "Guará", "Guaraçaí", "Guaraci", "Guarani d'Oeste", "Guarantã", "Guararapes", "Guararema", "Guaratinguetá", "Guareí", "Guariba", "Guarujá", "Guarulhos", "Guatapará", "Guzolândia", "Herculândia", "Holambra", "Hortolândia", "Iacanga", "Iacri", "Iaras", "Ibaté", "Ibirá", "Ibirarema", "Ibitinga", "Ibiúna", "Icém", "Iepê", "Igaraçu do Tietê", "Igarapava", "Igaratá", "Iguape", "Ilha Comprida", "Ilha Solteira", "Ilhabela", "Indaiatuba", "Indiana", "Indiaporã", "Inúbia Paulista", "Ipaussu", "Iperó", "Ipeúna", "Ipiguá", "Iporanga", "Ipuã", "Iracemápolis", "Irapuã", "Irapuru", "Itaberá", "Itaí", "Itajobi", "Itaju", "Itanhaém", "Itaoca", "Itapecerica da Serra", "Itapetininga", "Itapeva", "Itapevi", "Itapira", "Itapirapuã Paulista", "Itápolis", "Itaporanga", "Itapuí", "Itapura", "Itaquaquecetuba", "Itararé", "Itariri", "Itatiba", "Itatinga", "Itirapina", "Itirapuã", "Itobi", "Itu", "Itupeva", "Ituverava", "Jaborandi", "Jaboticabal", "Jacareí", "Jaci", "Jacupiranga", "Jaguariúna", "Jales", "Jambeiro", "Jandira", "Jardim", "Jarinu", "Jaú", "Jeriquara", "Joanópolis", "João Ramalho", "José Bonifácio", "Júlio Mesquita", "Jumirim", "Jundiaí", "Junqueirópolis", "Juquiá", "Juquitiba", "Lagoinha", "Laras", "Lauro Penteado", "Lavínia", "Lavrinhas", "Leme", "Lençóis Paulista", "Limeira", "Lindóia", "Lins", "Lorena", "Lourdes", "Louveira", "Lucélia", "Lucianópolis", "Luís Antônio", "Luiziânia", "Lupércio", "Lutécia", "Macatuba", "Macaubal", "Macedônia", "Magda", "Mairinque", "Mairiporã", "Manduri", "Marabá Paulista", "Maracaí", "Marapoama", "Mariápolis", "Marília", "Marinópolis", "Martinópolis", "Matão", "Mauá", "Mendonça", "Meridiano", "Mesópolis", "Miguelópolis", "Mineiros do Tietê", "Mira Estrela", "Miracatu", "Mirandópolis", "Mirante do Paranapanema", "Mirassol", "Mirassolândia", "Mococa", "Mogi das Cruzes", "Mogi Guaçu", "Mogi Mirim", "Mombuca", "Monções", "Mongaguá", "Monte Alegre do Sul", "Monte Alto", "Monte Aprazível", "Monte Azul Paulista", "Monte Castelo", "Monteiro Lobato", "Monte Mor", "Morro Agudo", "Morungaba", "Motuca", "Murutinga do Sul", "Nantes", "Narandiba", "Natividade da Serra", "Nazaré Paulista", "Neves Paulista", "Nhandeara", "Nipoã", "Nova Aliança", "Nova Campina", "Nova Canaã Paulista", "Nova Castilho", "Nova Europa", "Nova Granada", "Nova Guataporanga", "Nova Independência", "Nova Luzitânia", "Nova Odessa", "Novais", "Novo Horizonte", "Nuporanga", "Ocauçu", "Óleo", "Olímpia", "Onda Verde", "Oriente", "Orindiúva", "Orlândia", "Osasco", "Oscar Bressane", "Osvaldo Cruz", "Ourinhos", "Ouro Verde", "Ouroeste", "Pacaembu", "Palestina", "Palmares Paulista", "Palmeira d'Oeste", "Palmital", "Panorama", "Paraguaçu Paulista", "Paraibuna", "Paraíso", "Paranapanema", "Paranapuã", "Parapuã", "Pardinho", "Pariquera-Açu", "Parisi", "Patrocínio Paulista", "Paulicéia", "Paulínia", "Paulistânia", "Paulo de Faria", "Pederneiras", "Pedra Bela", "Pedranópolis", "Pedregulho", "Pedreira", "Pedrinhas Paulista", "Pedro de Toledo", "Penápolis", "Pereira Barreto", "Pereiras", "Peruíbe", "Piacatu", "Piedade", "Pilar do Sul", "Pindamonhangaba", "Pindorama", "Pinhalzinho", "Piquerobi", "Piquete", "Piracaia", "Piracicaba", "Piraju", "Pirajuí", "Pirangi", "Pirapora do Bom Jesus", "Pirapozinho", "Pirassununga", "Piratininga", "Pitangueiras", "Planalto", "Platina", "Poá", "Poloni", "Pompéia", "Pongaí", "Pontal", "Pontalinda", "Pontes Gestal", "Populina", "Porangaba", "Porto Feliz", "Porto Ferreira", "Potim", "Potirendaba", "Pracinha", "Pradópolis", "Praia Grande", "Pratânia", "Presidente Bernardes", "Presidente Epitácio", "Presidente Prudente", "Presidente Venceslau", "Promissão", "Quadra", "Quatá", "Queiroz", "Queluz", "Quintana", "Rafard", "Rancharia", "Redenção da Serra", "Regente Feijó", "Reginópolis", "Registro", "Restinga", "Ribeira", "Ribeirão Bonito", "Ribeirão Branco", "Ribeirão Corrente", "Ribeirão do Sul", "Ribeirão dos Índios", "Ribeirão Grande", "Ribeirão Pires", "Ribeirão Preto", "Rifaina", "Rincão", "Rinópolis", "Rio Claro", "Rio das Pedras", "Rio Grande da Serra", "Riolândia", "Riversul", "Rosana", "Roseira", "Rubiácea", "Rubinéia", "Sabino", "Sagres", "Sales", "Sales Oliveira", "Salesópolis", "Salmourão", "Saltinho", "Salto", "Salto de Pirapora", "Salto Grande", "Sandovalina", "Santa Adélia", "Santa Albertina", "Santa Bárbara d'Oeste", "Santa Branca", "Santa Clara d'Oeste", "Santa Cruz da Conceição", "Santa Cruz da Esperança", "Santa Cruz das Palmeiras", "Santa Cruz do Rio Pardo", "Santa Ernestina", "Santa Fé do Sul", "Santa Gertrudes", "Santa Isabel", "Santa Lúcia", "Santa Maria da Serra", "Santa Mercedes", "Santa Rita d'Oeste", "Santa Rita do Passa Quatro", "Santa Rosa de Viterbo", "Santa Salete", "Santana da Ponte Pensa", "Santana de Parnaíba", "Santo Anastácio", "Santo André", "Santo Antônio da Alegria", "Santo Antônio de Posse", "Santo Antônio do Aracanguá", "Santo Antônio do Jardim", "Santo Antônio do Pinhal", "Santo Expedito", "Santópolis do Aguapeí", "Santos", "São Bento do Sapucaí", "São Bernardo do Campo", "São Caetano do Sul", "São Carlos", "São Francisco", "São João da Boa Vista", "São João das Duas Pontes", "São João de Iracema", "São João do Pau d'Alho", "São Joaquim da Barra", "São José da Bela Vista", "São José do Barreiro", "São José do Rio Pardo", "São José do Rio Preto", "São José dos Campos", "São Lourenço da Serra", "São Luís do Paraitinga", "São Manuel", "São Miguel Arcanjo", "São Paulo", "São Pedro", "São Pedro do Turvo", "São Roque", "São Sebastião", "São Sebastião da Grama", "São Simão", "São Vicente", "Sarapuí", "Sarutaiá", "Sebastianópolis do Sul", "Serra Azul", "Serra Negra", "Serrana", "Sertãozinho", "Sete Barras", "Severínia", "Silveiras", "Socorro", "Sorocaba", "Sud Mennucci", "Sumaré", "Suzanápolis", "Suzano", "Tabapuã", "Tabatinga", "Taboão da Serra", "Taciba", "Taguaí", "Taiaçu", "Taiúva", "Tambaú", "Tanabi", "Tapiraí", "Tapiratiba", "Taquaral", "Taquaritinga", "Taquarituba", "Taquarivaí", "Tarabai", "Tarumã", "Tatuí", "Taubaté", "Tejupá", "Teodoro Sampaio", "Terra Roxa", "Tietê", "Timburi", "Torre de Pedra", "Torrinha", "Trabiju", "Tremembé", "Três Fronteiras", "Tuiuti", "Tupã", "Tupi Paulista", "Turiúba", "Turmalina", "Ubarana", "Ubatuba", "Ubirajara", "Uchoa", "União Paulista", "Urânia", "Uru", "Urupês", "Valentim Gentil", "Valinhos", "Valparaíso", "Vargem", "Vargem Grande do Sul", "Vargem Grande Paulista", "Várzea Paulista", "Vera Cruz", "Vinhedo", "Viradouro", "Vista Alegre do Alto", "Vitória Brasil", "Votorantim", "Votuporanga", "Zacarias", "Zórzima"]

