package com.example.apitest.tcp;

import org.springframework.stereotype.Component;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.Charset;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Component
public class TcpMockServer {
    
    private static final Logger log = LoggerFactory.getLogger(TcpMockServer.class);
    private static final int PORT = 9090;
    private static final Charset MS949 = Charset.forName("MS949");
    
    private ServerSocket serverSocket;
    private ExecutorService executorService;
    private volatile boolean running = false;
    
    @PostConstruct
    public void start() {
        executorService = Executors.newCachedThreadPool();
        executorService.submit(() -> {
            try {
                serverSocket = new ServerSocket(PORT);
                running = true;
                log.info("TCP Mock Server started on port {}", PORT);
                
                while (running) {
                    try {
                        Socket clientSocket = serverSocket.accept();
                        executorService.submit(() -> handleClient(clientSocket));
                    } catch (IOException e) {
                        if (running) {
                            log.error("Error accepting client connection", e);
                        }
                    }
                }
            } catch (IOException e) {
                log.error("Error starting TCP server", e);
            }
        });
    }
    
    @PreDestroy
    public void stop() {
        running = false;
        try {
            if (serverSocket != null && !serverSocket.isClosed()) {
                serverSocket.close();
            }
            if (executorService != null) {
                executorService.shutdownNow();
            }
            log.info("TCP Mock Server stopped");
        } catch (IOException e) {
            log.error("Error stopping TCP server", e);
        }
    }
    
    private void handleClient(Socket clientSocket) {
        try (
            InputStream in = clientSocket.getInputStream();
            OutputStream out = clientSocket.getOutputStream()
        ) {
            // Read fixed-length message
            // Format: cardNo(16) + settlementAmount(12) + requestMethod(2) = 30 bytes
            byte[] buffer = new byte[30];
            int bytesRead = in.read(buffer);
            
            if (bytesRead == 30) {
                // Parse by byte array slicing to handle MS949 multi-byte characters correctly
                String cardNo = new String(buffer, 0, 16, MS949).trim();
                String settlementAmount = new String(buffer, 16, 12, MS949).trim();
                String requestMethod = new String(buffer, 28, 2, MS949).trim();
                
                log.info("Received - cardNo: {}, amount: {}, method: {}", 
                    cardNo, settlementAmount, requestMethod);
                
                // Generate response
                String response = generateResponse(cardNo, settlementAmount, requestMethod);
                byte[] responseBytes = response.getBytes(MS949);
                
                if (responseBytes.length != 37) {
                    log.warn("Response byte length is {} instead of 37. Response: {}", responseBytes.length, response);
                }
                
                out.write(responseBytes);
                out.flush();
                
                log.info("Sent response ({} bytes): {}", responseBytes.length, response);
            }
        } catch (Exception e) {
            log.error("Error handling client", e);
        } finally {
            try {
                clientSocket.close();
            } catch (IOException e) {
                log.error("Error closing client socket", e);
            }
        }
    }
    
    private String generateResponse(String cardNo, String amount, String method) {
        // Generate mock response
        // Format: responseCode(4) + approvalNo(12) + responseMessage(20) + discountYn(1) = 37 bytes
        
        String responseCode = "0000"; // Success
        String approvalNo = String.format("%012d", System.currentTimeMillis() % 1000000000000L);
        String responseMessage = padRight("정상승인", 20);
        String discountYn = "Y";
        
        // Check for error cases (for testing)
        if (cardNo.startsWith("9999")) {
            responseCode = "9999";
            responseMessage = padRight("거절", 20);
            approvalNo = "000000000000";
        }
        
        String response = responseCode + approvalNo + responseMessage + discountYn;
        return response;
    }
    
    private String padRight(String s, int byteLength) {
        try {
            byte[] bytes = s.getBytes(MS949);
            
            if (bytes.length >= byteLength) {
                // Truncate to exact byte length
                return new String(bytes, 0, byteLength, MS949);
            }
            
            // Pad with spaces to reach byte length
            byte[] padded = new byte[byteLength];
            System.arraycopy(bytes, 0, padded, 0, bytes.length);
            for (int i = bytes.length; i < byteLength; i++) {
                padded[i] = (byte) ' ';
            }
            return new String(padded, MS949);
        } catch (Exception e) {
            // Fallback to simple padding if error
            StringBuilder sb = new StringBuilder(s);
            while (sb.length() < byteLength) {
                sb.append(' ');
            }
            return sb.toString();
        }
    }
}
