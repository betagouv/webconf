# Webconf Access

## Dev de l'app de webconf

- Variables d'environnement nécessaires :
   - AUTHORIZED_DOMAINS
   - AUTHORIZED_EMAILS
   - SESSION_SECRET (clé de 32 caractère aléatoires, important en prod)
   - MAIL_SERVICE (service géré par nodemailer, `mailjet` est dispo)
   - MAIL_USER
   - MAIL_PASS
   - SECURE (true si https sinon false)
- Récupérer les dépendances avec npm
- Lancer l'app : `npm run dev`
- Ouvrir `http://localhost:8100` (8100 est le port par défaut, vous pouvez le changer avec la variable d'env PORT)

## Dev docker-compose

- Récupérer les dépendances : `docker-compose run web npm install`
- Lancer le service : `docker-compose up`
- Lancer les tests : `docker-compose run web npm test`


## Production

`npm run start`
