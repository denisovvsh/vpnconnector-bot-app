<?php
/* Servers configuration */
$i = 0;

/* First server */
$i++;
$cfg['Servers'][$i]['auth_type'] = 'cookie';
$cfg['Servers'][$i]['host'] = 'mysql-server'; // Замените на имя вашего хоста базы данных
$cfg['Servers'][$i]['port'] = '';
$cfg['Servers'][$i]['socket'] = '';
$cfg['Servers'][$i]['connect_type'] = 'tcp';
$cfg['Servers'][$i]['compress'] = false;
$cfg['Servers'][$i]['extension'] = 'mysqli';
$cfg['Servers'][$i]['AllowNoPassword'] = false;

/* Blowfish secret */
$cfg['blowfish_secret'] = '';

/* Directories for saving/loading files from server */
$cfg['UploadDir'] = '';
$cfg['SaveDir'] = '';
