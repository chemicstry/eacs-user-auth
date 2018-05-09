export default [
    {
        name: 'port',
        alias: 'p',
        type: Number,
        defaultValue: 3001,
        description: 'Port number of websocket'
    },
    {
        name: 'host',
        alias: 'h',
        type: String,
        defaultValue: '::',
        description: 'Host (IP) of websocket'
    },
    {
        name: 'jwtPublicKey',
        type: String,
        defaultValue: 'jwt.pem',
        description: 'Public key (in PEM format) used for JWT verification'
    },
    {
        name: 'ldapURL',
        type: String,
        defaultValue: 'ldap://192.168.1.183:389',
        description: 'LDAP server URL'
    },
    {
        name: 'ldapUser',
        type: String,
        defaultValue: 'cn=admin,dc=example,dc=com',
        description: 'LDAP server bind user'
    },
    {
        name: 'ldapPass',
        type: String,
        defaultValue: 'admin',
        description: 'LDAP server bind password'
    },
    {
        name: 'help',
        type: Boolean,
        description: 'Prints usage information'
    }
];
