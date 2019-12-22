#!/usr/bin/env python3

import time
from neopixel import *
import argparse
from flask import Flask, request
from threading import Thread, Lock, Condition
from collections import deque
from math import cos, pi
import random

# LED strip configuration:
LED_COUNT      = 120      # Number of LED pixels.
LED_PIN        = 18      # GPIO pin connected to the pixels (18 uses PWM!).
LED_FREQ_HZ    = 800000  # LED signal frequency in hertz (usually 800khz)
LED_DMA        = 10      # DMA channel to use for generating signal (try 10)
LED_BRIGHTNESS = 120     # Set to 0 for darkest and 255 for brightest
LED_INVERT     = False   # True to invert the signal (when using NPN transistor level shift)
LED_CHANNEL    = 0       # set to '1' for GPIOs 13, 19, 41, 45 or 53

def wheel(pos):
    """Generate rainbow colors across 0-255 positions."""
    if pos < 85:
        return Color(pos * 3, 255 - pos * 3, 0)
    elif pos < 170:
        pos -= 85
        return Color(255 - pos * 3, 0, pos * 3)
    else:
        pos -= 170
        return Color(0, pos * 3, 255 - pos * 3)

strip = None

def init_strip():
    # Create NeoPixel object with appropriate configuration.
    global strip
    strip = Adafruit_NeoPixel(LED_COUNT, LED_PIN, LED_FREQ_HZ, LED_DMA, LED_INVERT, LED_BRIGHTNESS, LED_CHANNEL)
    # Intialize the library (must be called once before other functions).
    strip.begin()

class LightsThread(Thread):
    def __init__(self, mode):
        super().__init__()
        self.beats = deque([])
        self.lock = Lock()
        self.condition = Condition(self.lock)
        self.has_data = False
        self.mode = mode
        self.current_color = (255, 125, 255)

    def set_beats(self, beats):
        self.condition.acquire()
        self.beats = deque(beats)
        self.has_data = len(beats) != 0
        print("Reset beats. New number: " + str(len(beats)))
        self.condition.notify()
        self.condition.release()

    def change_mode(self, mode):
        self.condition.acquire()
        self.mode = mode
        self.condition.notify()
        self.condition.release()

    def run(self):
        while True:
            self.lock.acquire()
            mode = self.mode
            self.lock.release()

            if mode == "beats":
                self.run_beats_mode()
            elif mode == "rainbow":
                self.run_rainbow_mode()
            elif mode == "static":
                self.run_static_mode()
            elif mode == "tequila":
                self.run_tequila_mode()

    def run_beats_mode(self):
        self.condition.acquire()
        while len(self.beats) == 0:
            self.condition.wait()
        
        if self.mode != "beats":
            self.condition.release()
            return

        beat = self.beats.popleft()
        self.condition.release()

        for i in range(strip.numPixels()):
            strip.setPixelColorRGB(i, self.current_color[0], self.current_color[1], self.current_color[2])
        
        num_iterations = 20
        minimum_brightness = 30
        for it in range(num_iterations):
            for i in range(strip.numPixels()):
                # brightness = int(255 - abs((it - num_iterations / 2)) * 255 * 2/ num_iterations) 
                brightness = int((255.0 - minimum_brightness) * cos((it - num_iterations/2) * pi / num_iterations) + minimum_brightness)
                strip.setBrightness(brightness)
            
            strip.show()
            time.sleep(beat['duration']/num_iterations)
        
        self.color_random_step()
        
    def run_tequila_mode(self):
        while True:
            for q in range(3):
                self.condition.acquire()
                if self.mode != "tequila":
                    self.condition.release()
                    print("Mode is not tequila anymore")
                    return
                self.condition.release()

                for i in range(0, strip.numPixels(), 3):
                    strip.setPixelColorRGB(i+q, 0, 242, 0)
                    strip.setPixelColorRGB(i+q+1, 60, 220, 0)
                    strip.setPixelColorRGB(i+q+2, 60, 220, 0)
                strip.show()
                time.sleep(0.2)

    def run_static_mode(self):
        for i in range(strip.numPixels()):
            strip.setPixelColorRGB(i, self.current_color[0], self.current_color[1], self.current_color[2])
    
    def run_rainbow_mode(self):
        j = 0

        while True:
            self.condition.acquire()
            if self.mode != "rainbow":
                self.condition.release()
                return
            self.condition.release()

            time.sleep(0.001)
            for i in range(strip.numPixels()):
                strip.setPixelColor(i, wheel((int(i * 256 / strip.numPixels()) + j) & 255))
            strip.show()
            j += 1
    
    def color_random_step(self):
        color = self.current_color
        r_move = random.random() * 80
        g_move = random.random() * 80
        b_move = random.random() * 80

        r_direction = random.random()
        g_direction = random.random()
        b_direction = random.random()

        r_direction = 1.0 if r_direction > color[0] / 255.0 else -1.0
        g_direction = 1.0 if g_direction > color[1] / 255.0 else -1.0
        b_direction = 1.0 if b_direction > color[2] / 255.0 else -1.0

        self.current_color = (max(min(int(color[0] + r_direction * r_move), 255), 0), max(min(int(color[1] + g_direction * g_move), 255), 0), max(min(int(color[2] + b_direction * b_move), 255), 0))


app = Flask(__name__)
current_thread = None
current_mode = "beats"
    
def perform_mode_change(mode):
    global current_mode
    global current_thread

    correct_modes = {"beats", "tequila", "static", "rainbow"}

    if not mode in correct_modes:
        return "Failure! Mode " + str(mode) +  " is not supported"

    current_mode = mode
    if current_thread is not None:
        current_thread.change_mode(current_mode)
    else:
        current_thread = LightsThread(current_mode)
        current_thread.start()
    return "Success"

@app.route('/mode', methods = ['POST'])
def change_mode():
    return perform_mode_change(request.data.decode('utf8'))

@app.route('/tequila', methods = ['POST'])
def tequila():
    return perform_mode_change("tequila")

@app.route("/start", methods = ['POST'])
def start():
    values = request.json
    duration = values['track']['duration']
    bpm = values['track']['tempo']
    beat_duration = 1.0 / bpm * 60
    progress = values['progress_ms'] * 1000 
    # beats = [ {'duration' : min(beat_duration, duration - i * beat_duration) } for i in range(int((duration - progress) / beat_duration)) ]
    beats = list(filter(lambda b: b['start'] + b['duration'] > progress, values['beats']))
    if len(beats) > 0:
        beats[0]['duration'] = beats[0]['start'] + beats[0]['duration'] - progress

    global current_thread
    global current_mode

    if current_thread is None:
        current_thread = LightsThread(current_mode)
        current_thread.start()
    
    current_thread.set_beats(beats)

    return ""


# Main program logic follows:
if __name__ == '__main__':
    init_strip()
    app.run(host='0.0.0.0', port=80)
