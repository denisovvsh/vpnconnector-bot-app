FROM phpmyadmin/phpmyadmin:5.0.1

RUN docker-php-ext-install mysqli pdo pdo_mysql
# Устанавливаем значения директив PHP для увеличения размера импортируемого файла
RUN echo 'upload_max_filesize = 100M' > /usr/local/etc/php/conf.d/uploads.ini
RUN echo 'post_max_size = 100M' >> /usr/local/etc/php/conf.d/uploads.ini
RUN echo 'memory_limit = 256M' >> /usr/local/etc/php/conf.d/uploads.ini
RUN echo 'max_execution_time = 300' >> /usr/local/etc/php/conf.d/uploads.ini

COPY ./phpmyadmin/config.inc.php /etc/phpmyadmin/config.inc.php
