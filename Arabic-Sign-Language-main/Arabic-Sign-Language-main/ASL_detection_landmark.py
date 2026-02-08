import os
import warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'  # 0=tout, 1=INFO, 2=WARNING, 3=ERROR seulement
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['GLOG_minloglevel'] = '2'       # reduit logs Abseil/MLIR
warnings.filterwarnings('ignore', category=DeprecationWarning, module='tensorflow')
warnings.filterwarnings('ignore', message='.*input_shape.*input_dim.*')

from utils import detector_utils as detector_utils
import cv2
import numpy as np
import tensorflow.compat.v1 as tf
tf.compat.v1.disable_v2_behavior()
import multiprocessing
from multiprocessing import Queue, Pool, Process
import tempfile
import time
from utils.detector_utils import WebcamVideoStream
import datetime
import argparse
# install: pip install --upgrade arabic-reshaper
import arabic_reshaper

# install: pip install python-bidi
from bidi.algorithm import get_display
import imutils
try:
    import dlib
    from imutils import face_utils
    DLIB_AVAILABLE = True
except ImportError:
    dlib = None
    face_utils = None
    DLIB_AVAILABLE = False
# install: pip install Pillow
from PIL import ImageFont
from PIL import Image
from PIL import ImageDraw

# Architecture du modele ASL (identique a asl_model.h5) - Input en premier pour eviter warning Keras 3
def _build_asl_model():
    k = tf.keras
    model = k.Sequential([
        k.layers.Input(shape=(64, 64, 3)),
        k.layers.Conv2D(32, (3, 3), activation='relu', name='conv2d_6'),
        k.layers.MaxPooling2D((2, 2), name='max_pooling2d_4'),
        k.layers.Conv2D(64, (3, 3), activation='relu', name='conv2d_7'),
        k.layers.MaxPooling2D((2, 2), name='max_pooling2d_5'),
        k.layers.Conv2D(64, (3, 3), activation='relu', name='conv2d_8'),
        k.layers.Flatten(name='flatten_2'),
        k.layers.Dense(64, activation='relu', name='dense_4'),
        k.layers.Dense(32, activation='softmax', name='dense_5'),
    ])
    return model

frame_processed = 0
score_thresh = 0.18

# Create a worker thread that loads graph and
# does detection on images in an input queue and puts it on an output queue

res, score = '', 0.0
sequence = ''
fontFile = "fonts/Sahel.ttf"
font = ImageFont.truetype(fontFile, 70)
font_big = ImageFont.truetype(fontFile, 110)  # lettre bien visible sur la camera
font_score = ImageFont.truetype(fontFile, 28)
categories=[
["ain",'ع'],
["al","ال"],
["aleff",'أ'],
["bb",'ب'],
["dal",'د'],
["dha",'ط'],
["dhad","ض"],
["fa","ف"],
["gaaf",'ج'],
["ghain",'غ'],
["ha",'ه'],
["haa",'ه'],
["jeem",'ج'],
["kaaf",'ك'],
["la",'لا'],
["laam",'ل'],
["meem",'م'],
["nun","ن"],
["ra",'ر'],
["saad",'ص'],
["seen",'س'],
["sheen","ش"],
["ta",'ت'],
["taa",'ط'],
["thaa","ث"],
["thal","ذ"],
["toot",'ت'],
["waw",'و'],
["ya","ى"],
["yaa","ي"],
["zay",'ز']]
def process_image(img):
    img = cv2.flip(img, 1)
    h, w = img.shape[:2]
    interp = cv2.INTER_CUBIC if (w < 64 or h < 64) else cv2.INTER_AREA
    img = cv2.resize(img, (64, 64), interpolation=interp)
    img = np.array(img, dtype=np.float32)
    img = np.reshape(img, (-1, 64, 64, 3))
    img = img.astype('float32') / 255.
    return img

def worker(input_q, output_q, cropped_output_q, inferences_q, landmark_ouput_q, cap_params, frame_processed, predictor_input_q, predictor_output_q):
    import contextlib
    import sys
    @contextlib.contextmanager
    def _suppress_stderr():
        try:
            stderr_fd = sys.stderr.fileno()
            with open(os.devnull, 'w') as devnull:
                old_stderr = os.dup(stderr_fd)
                os.dup2(devnull.fileno(), stderr_fd)
                try:
                    yield
                finally:
                    os.dup2(old_stderr, stderr_fd)
                    os.close(old_stderr)
        except Exception:
            yield

    print(">> loading frozen model for worker")
    with _suppress_stderr():
        detection_graph, sess = detector_utils.load_inference_graph()
        sess = tf.Session(graph=detection_graph)
    detector = None
    predictor = None
    if DLIB_AVAILABLE:
        try:
            detector = dlib.get_frontal_face_detector()
            predictor = dlib.shape_predictor("landmarks/shape_predictor_68_face_landmarks.dat")
        except Exception as e:
            print(">> dlib/landmarks non disponible:", e)

    print(">> Prediction ASL via processus dedie (modele eager)")

    while True:
        frame = input_q.get()
        if (frame is not None):
            boxes, scores = detector_utils.detect_objects(
                frame, detection_graph, sess)


            # get region of interest
            res = detector_utils.get_box_image(cap_params['num_hands_detect'], cap_params["score_thresh"],
                scores, boxes, cap_params['im_width'], cap_params['im_height'], frame)
            
            # draw bounding boxes
            detector_utils.draw_box_on_image(cap_params['num_hands_detect'], cap_params["score_thresh"],
               scores, boxes, cap_params['im_width'], cap_params['im_height'], frame)
            
            # classify hand via processus predictor (eager)
            if res is not None:
                class_res = "empty"
                try:
                    with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as f:
                        crop_path = f.name
                    cv2.imwrite(crop_path, cv2.cvtColor(res, cv2.COLOR_RGB2BGR))
                    try:
                        predictor_input_q.put(crop_path)
                        score, letter = predictor_output_q.get(timeout=8.0)
                        if letter:
                            class_res = str(score) + "/" + letter
                    except Exception:
                        pass
                    try:
                        os.unlink(crop_path)
                    except Exception:
                        pass
                except Exception:
                    pass
                inferences_q.put(class_res)    

            image_np1 = imutils.resize(frame, width=400)
            if detector is not None and predictor is not None:
                gray = cv2.cvtColor(image_np1, cv2.COLOR_BGR2GRAY)
                rects = detector(gray, 0)
                for rect in rects:
                    shape = predictor(gray, rect)
                    shape = face_utils.shape_to_np(shape)
                    for (x, y) in shape:
                        cv2.circle(image_np1, (x, y), 1, (0, 0, 255), -1)

            # add frame annotated with bounding box to queue
            landmark_ouput_q.put(image_np1)
            cropped_output_q.put(res)
            output_q.put(frame)
            
            frame_processed += 1
        else:
            output_q.put(frame)
    sess.close()


if __name__ == '__main__':

    parser = argparse.ArgumentParser()
    parser.add_argument(
        '-src',
        '--source',
        dest='video_source',
        type=int,
        default=0,
        help='Device index of the camera.')
    parser.add_argument(
        '-nhands',
        '--num_hands',
        dest='num_hands',
        type=int,
        default=1,
        help='Max number of hands to detect.')
    parser.add_argument(
        '-fps',
        '--fps',
        dest='fps',
        type=int,
        default=1,
        help='Show FPS on detection/display visualization')
    parser.add_argument(
        '-wd',
        '--width',
        dest='width',
        type=int,
        default=1280,
        help='Width of the frames in the video stream.')
    parser.add_argument(
        '-ht',
        '--height',
        dest='height',
        type=int,
        default=720,
        help='Height of the frames in the video stream.')
    parser.add_argument(
        '-ds',
        '--display',
        dest='display',
        type=int,
        default=1,
        help='Display the detected images using OpenCV. This reduces FPS')
    parser.add_argument(
        '-num-w',
        '--num-workers',
        dest='num_workers',
        type=int,
        default=4,
        help='Number of workers.')
    parser.add_argument(
        '-q-size',
        '--queue-size',
        dest='queue_size',
        type=int,
        default=5,
        help='Size of the queue.')
    args = parser.parse_args()

    input_q             = Queue(maxsize=args.queue_size)
    output_q            = Queue(maxsize=args.queue_size)
    cropped_output_q    = Queue(maxsize=args.queue_size)
    inferences_q        = Queue(maxsize=args.queue_size)
    landmark_ouput_q    = Queue(maxsize=args.queue_size)
    predictor_input_q  = Queue()
    predictor_output_q = Queue()

    from asl_predictor_process import run_predictor
    predictor_proc = Process(target=run_predictor, args=(predictor_input_q, predictor_output_q))
    predictor_proc.start()
    print(">> Lettre et score sur les fenetres ASL, Cropped et LandMark. 1ere detection: patientez ~10 s.")

    video_capture = WebcamVideoStream(
        src=args.video_source, width=args.width, height=args.height).start()

    cap_params = {}
    frame_processed = 0
    cap_params['im_width'], cap_params['im_height'] = video_capture.size()
    print(cap_params['im_width'], cap_params['im_height'])
    cap_params['score_thresh'] = score_thresh

    # max number of hands we want to detect/track
    cap_params['num_hands_detect'] = args.num_hands

    print(cap_params, args)

    # spin up workers to paralleize detection.
    pool = Pool(args.num_workers, worker,
                (input_q, output_q, cropped_output_q, inferences_q, landmark_ouput_q, cap_params, frame_processed, predictor_input_q, predictor_output_q))

    start_time = datetime.datetime.now()
    num_frames = 0
    fps = 0
    index = 0
    last_terminal_letter = None
    last_terminal_frame = 0
    last_display_letter = None
    last_display_score = None
    last_display_frame = 0
    DISPLAY_HOLD_FRAMES = 45
    # Lissage temporel: garder les N dernieres predictions, n'afficher que si stable ou confiance haute
    prediction_history = []
    PREDICTION_HISTORY_SIZE = 5
    MIN_CONSECUTIVE_SAME = 2
    CONFIDENCE_THRESHOLD_HIGH = 0.85

    cv2.namedWindow('ASL', cv2.WINDOW_NORMAL)

    while True:
        frame = video_capture.read()
        frame = cv2.flip(frame, 1)
        index += 1

        input_q.put(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

        output_frame = output_q.get()
        cropped_output = cropped_output_q.get()
        landmark_ouput = landmark_ouput_q.get()

        score, sequence = 0.0, ""
        inferences = None
        try:
            while True:
                inferences = inferences_q.get_nowait()
        except Exception:
            pass

        if inferences is not None:
            try:
                score = inferences.split('/')[0]
                sequence = inferences.split('/')[1]
            except Exception:
                score = 0.0
                sequence = ""

        model_letter = sequence if (sequence and str(sequence).strip() != "empty") else None
        model_score = None
        if inferences is not None:
            try:
                model_score = float(score)
            except Exception:
                pass
        if model_letter is not None and model_score is not None:
            prediction_history.append((model_letter, model_score))
            if len(prediction_history) > PREDICTION_HISTORY_SIZE:
                prediction_history.pop(0)
            # Afficher si: meme lettre au moins MIN_CONSECUTIVE_SAME fois, ou confiance > seuil
            letters_recent = [p[0] for p in prediction_history]
            scores_recent = [p[1] for p in prediction_history]
            best_letter = max(set(letters_recent), key=letters_recent.count) if letters_recent else None
            count_best = letters_recent.count(best_letter) if best_letter else 0
            score_best = max((s for l, s in prediction_history if l == best_letter), default=0.0)
            if best_letter and (count_best >= MIN_CONSECUTIVE_SAME or (score_best / 100.0) >= CONFIDENCE_THRESHOLD_HIGH):
                last_display_letter = best_letter
                last_display_score = score_best
                last_display_frame = num_frames
        else:
            prediction_history.clear()
        if last_display_letter is not None and (num_frames - last_display_frame) <= DISPLAY_HOLD_FRAMES:
            display_letter = last_display_letter
            display_score = last_display_score
        else:
            display_letter = model_letter
            display_score = model_score if model_letter is not None else None
        reshaped_text = arabic_reshaper.reshape(display_letter or "") if (display_letter or "") else ""
        bidi_text = get_display(reshaped_text) if reshaped_text else ""

        # Affichage clair dans le terminal (quand lettre valide, eviter spam)
        if display_letter is not None and display_score is not None:
            if display_letter != last_terminal_letter or (num_frames - last_terminal_frame) > 15:
                last_terminal_letter = display_letter
                last_terminal_frame = num_frames
                print("  >>> LETTRE (modele): %s  |  Score: %.1f%%" % (bidi_text, display_score))

        elapsed_time = (datetime.datetime.now() - start_time).total_seconds()
        num_frames += 1
        fps = num_frames / elapsed_time

        if (cropped_output is not None):
            cropped_output = cv2.cvtColor(cropped_output, cv2.COLOR_RGB2BGR)
            if display_letter is not None:
                img_pil = Image.fromarray(cropped_output)
                draw = ImageDraw.Draw(img_pil)
                draw.text((30, 100), bidi_text, (255, 0, 0), font=font)
                cropped_output = np.array(img_pil)
            if (args.display > 0):
                cv2.namedWindow('Cropped', cv2.WINDOW_NORMAL)
                cv2.resizeWindow('Cropped', 550, 400)
                cv2.imshow('Cropped', cropped_output)
                #cv2.imwrite('image_' + str(num_frames) + '.png', cropped_output)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
            else:
                if (num_frames == 400):
                    num_frames = 0
                    start_time = datetime.datetime.now()
                else:
                    print("frames processed: ", index, "elapsed time: ",
                          elapsed_time, "fps: ", str(int(fps)))

    
        if (landmark_ouput is not None):
            landmark_ouput = cv2.cvtColor(landmark_ouput, cv2.COLOR_RGB2BGR)
            if display_letter is not None and display_score is not None:
                landmark_pil = Image.fromarray(cv2.cvtColor(landmark_ouput, cv2.COLOR_BGR2RGB))
                draw_lm = ImageDraw.Draw(landmark_pil)
                draw_lm.rectangle([(10, 5), (280, 100)], fill=(30, 30, 30), outline=(100, 200, 100))
                draw_lm.text((20, 12), "Lettre: %s  Score: %.1f%%" % (bidi_text, display_score), (255, 255, 255), font=font_score)
                landmark_ouput = cv2.cvtColor(np.array(landmark_pil), cv2.COLOR_RGB2BGR)
            if (args.display > 0):
                cv2.namedWindow('LandMark', cv2.WINDOW_NORMAL)
                cv2.resizeWindow('LandMark', 550, 400)
                cv2.imshow('LandMark', landmark_ouput)
                #cv2.imwrite('image_' + str(num_frames) + '.png', cropped_output)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
            else:
                if (num_frames == 400):
                    num_frames = 0
                    start_time = datetime.datetime.now()
                else:
                    print("frames processed: ", index, "elapsed time: ",
                          elapsed_time, "fps: ", str(int(fps)))

        if (output_frame is not None):
            # Afficher la lettre et le score sur la camera (fenetre ASL = vue principale)
            if display_letter is not None and display_score is not None:
                output_frame_rgb = output_frame.copy()
                img_pil = Image.fromarray(output_frame_rgb)
                draw = ImageDraw.Draw(img_pil)
                draw.rectangle([(10, 5), (340, 195)], fill=(30, 30, 30), outline=(100, 200, 100))
                draw.text((20, 12), "Lettre:", (180, 180, 180), font=font_score)
                draw.text((20, 45), bidi_text, (255, 255, 255), font=font_big)
                draw.text((20, 165), "Score: %.1f%%" % display_score, (150, 255, 150), font=font_score)
                output_frame = np.array(img_pil)
            output_frame = cv2.cvtColor(output_frame, cv2.COLOR_RGB2BGR)
            if (args.display > 0):
                if (args.fps > 0):
                    detector_utils.draw_fps_on_image("FPS : " + str(int(fps)),
                                                     output_frame)
                cv2.imshow('ASL', output_frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
            else:
                if (num_frames == 400):
                    num_frames = 0
                    start_time = datetime.datetime.now()
                else:
                    print("frames processed: ", index, "elapsed time: ",
                          elapsed_time, "fps: ", str(int(fps)))
        else:
            print("video end")
            break
    elapsed_time = (datetime.datetime.now() - start_time).total_seconds()
    fps = num_frames / elapsed_time
    print("fps", fps)
    predictor_input_q.put(None)
    predictor_proc.join(timeout=3.0)
    if predictor_proc.is_alive():
        predictor_proc.terminate()
    pool.terminate()
    video_capture.stop()
    cv2.destroyAllWindows()

