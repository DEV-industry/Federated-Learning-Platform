package com.flplatform.aggregator;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String QUEUE_NAME = "model-aggregation-queue";
    public static final String EXCHANGE_NAME = "model-exchange";
    public static final String ROUTING_KEY = "model.routing.key";

    @Bean
    public Queue modelQueue() {
        return new Queue(QUEUE_NAME, true);
    }

    @Bean
    public DirectExchange modelExchange() {
        return new DirectExchange(EXCHANGE_NAME);
    }

    @Bean
    public Binding binding(Queue modelQueue, DirectExchange modelExchange) {
        return BindingBuilder.bind(modelQueue).to(modelExchange).with(ROUTING_KEY);
    }

    @Bean
    public Jackson2JsonMessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}
