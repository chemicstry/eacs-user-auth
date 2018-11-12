"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = [
    {
        name: 'port',
        alias: 'p',
        type: Number,
        defaultValue: 3000,
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
        name: 'tls_cert',
        type: String,
        defaultValue: 'tls_cert.pem',
        description: 'TLS certificate file (leave blank to disable TLS)'
    },
    {
        name: 'tls_key',
        type: String,
        defaultValue: 'tls_key.pem',
        description: 'TLS key file'
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
        name: 'ldapCert',
        type: String,
        defaultValue: 'ldap_cert.pem',
        description: 'LDAP server certificate file if using ldaps scheme'
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
        name: 'ldapSearchBase',
        type: String,
        defaultValue: 'dc=example,dc=com',
        description: 'LDAP search base dn'
    },
    {
        name: 'help',
        type: Boolean,
        description: 'Prints usage information'
    }
];
