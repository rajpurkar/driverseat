## Useful Notes
- db.js deals with the saving of labels. They are made in the database for tags, but in the filesystem for lane labels. Note that we can handle connections to a shared mongolab database if you have a credentials file in the root of the repo which contain your preset username and password.
- util.js contains useful server-side javascript which does not fit into one particular module.
- tag.js, run.js, category.js, and user.js are mongoose database models. It basically defines what information each of these contains that we store in a database. A similar schema can be used for other types of database models.

## Almost certainly not useful
- auth.js, hash.js and authrenderer.js handle logins, and signups. It's unlikely they have to be modified.